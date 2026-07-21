import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache';
import { GitHubPR } from '../../common/types/daily-digest.types';
import { AppConfiguration } from '../../config/configuration';
import { GitHubGraphQlResponse, GitHubPRNode } from './github.types';
import { GitHubService } from './github.service';

const mappedPR: GitHubPR = {
  id: 42,
  title: 'Add GitHub integration',
  url: 'https://github.com/example/repo/pull/42',
  repo: 'example/repo',
  status: 'open',
  isDraft: false,
  hasNewComments: true,
  checkStatus: 'success',
  hasConflicts: false,
  updatedAt: '2026-07-20T12:00:00.000Z',
};

const githubPRNode: GitHubPRNode = {
  id: 'PR_kwDOExample',
  number: 42,
  title: 'Add GitHub integration',
  url: 'https://github.com/example/repo/pull/42',
  isDraft: false,
  updatedAt: '2026-07-20T12:00:00.000Z',
  mergeable: 'MERGEABLE',
  repository: {
    nameWithOwner: 'example/repo',
  },
  state: 'OPEN',
  commits: {
    nodes: [
      {
        commit: {
          statusCheckRollup: {
            state: 'SUCCESS',
          },
        },
      },
    ],
  },
  comments: {
    totalCount: 1,
    nodes: [
      {
        createdAt: '2026-07-20T11:30:00.000Z',
        author: { login: 'reviewer' },
      },
    ],
  },
  reviews: {
    totalCount: 0,
    nodes: [],
  },
};

const githubResponse: GitHubGraphQlResponse = {
  data: {
    search: {
      nodes: [githubPRNode],
    },
  },
};

describe('GitHubService', () => {
  let cache: jest.Mocked<CacheService>;
  let config: ConfigService<AppConfiguration, true>;
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let loggerErrorSpy: jest.SpiedFunction<Logger['error']>;
  let service: GitHubService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-20T12:00:00.000Z'));
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;
    config = {
      get: jest.fn((key: string) => {
        if (key === 'github.token') return 'github-token';
        if (key === 'github.username') return 'octocat';
        return undefined;
      }),
    } as unknown as ConfigService<AppConfiguration, true>;
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    global.fetch = fetchMock;
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new GitHubService(config, cache);
  });

  afterEach(() => {
    jest.useRealTimers();
    loggerErrorSpy.mockRestore();
  });

  it('returns cached PRs without calling GitHub', async () => {
    cache.get.mockResolvedValue([mappedPR]);

    await expect(service.getPRs()).resolves.toEqual([mappedPR]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(cache.set.mock.calls).toHaveLength(0);
  });

  it('fetches, maps, and caches GitHub PRs on cache miss', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(githubResponse),
    } as unknown as Response);

    await expect(service.getPRs()).resolves.toEqual([mappedPR]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer github-token',
          'Content-Type': 'application/json',
        },
      }),
    );
    const [, requestInit] = fetchMock.mock.calls[0];
    if (typeof requestInit?.body !== 'string') {
      throw new Error('Expected GitHub request body to be a string');
    }
    const requestBody = JSON.parse(requestInit.body) as {
      query: string;
      variables: { query: string };
    };
    expect(requestBody.query).toContain('query SearchAssignedPRs');
    expect(requestBody.variables.query).toBe('is:pr is:open author:octocat');
    expect(cache.set.mock.calls).toEqual([
      ['github:prs', [mappedPR], 300],
      ['github:prs:last-success', [mappedPR], 86400],
    ]);
  });

  it('maps merge conflicts, draft status, failing checks, and review comments', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: {
          search: {
            nodes: [
              {
                ...githubPRNode,
                isDraft: true,
                mergeable: 'CONFLICTING',
                commits: {
                  nodes: [
                    {
                      commit: {
                        statusCheckRollup: {
                          state: 'FAILURE',
                        },
                      },
                    },
                  ],
                },
                comments: {
                  totalCount: 1,
                  nodes: [
                    {
                      createdAt: '2026-07-20T11:40:00.000Z',
                      author: { login: 'octocat' },
                    },
                  ],
                },
                reviews: {
                  totalCount: 1,
                  nodes: [
                    {
                      createdAt: '2026-07-20T11:50:00.000Z',
                      author: { login: 'reviewer' },
                    },
                  ],
                },
              } satisfies GitHubPRNode,
            ],
          },
        },
      } satisfies GitHubGraphQlResponse),
    } as unknown as Response);

    await expect(service.getPRs()).resolves.toEqual([
      {
        ...mappedPR,
        status: 'draft',
        isDraft: true,
        hasNewComments: true,
        checkStatus: 'failure',
        hasConflicts: true,
      },
    ]);
  });

  it('maps absent check status and old self-authored comments to pending without new comments', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: {
          search: {
            nodes: [
              {
                ...githubPRNode,
                commits: { nodes: [] },
                comments: {
                  totalCount: 1,
                  nodes: [
                    {
                      createdAt: '2026-07-19T11:59:00.000Z',
                      author: { login: 'reviewer' },
                    },
                    {
                      createdAt: '2026-07-20T11:59:00.000Z',
                      author: { login: 'octocat' },
                    },
                  ],
                },
              } satisfies GitHubPRNode,
            ],
          },
        },
      } satisfies GitHubGraphQlResponse),
    } as unknown as Response);

    await expect(service.getPRs()).resolves.toEqual([
      {
        ...mappedPR,
        hasNewComments: false,
        checkStatus: 'pending',
      },
    ]);
  });

  it('returns an empty list and logs when GitHub GraphQL returns errors', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        errors: [{ message: 'Bad credentials' }],
      } satisfies GitHubGraphQlResponse),
    } as unknown as Response);

    await expect(service.getPRs()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('GitHub GraphQL error: Bad credentials');
    expect(cache.set.mock.calls).toEqual([['github:prs', [], 30]]);
  });

  it('returns an empty list for invalid credentials', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(service.getPRs()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('GitHub: token invalido o expirado');
    expect(cache.set.mock.calls).toEqual([['github:prs', [], 30]]);
  });

  it('returns fallback cached data on rate limit when available', async () => {
    cache.get.mockResolvedValueOnce(null).mockResolvedValueOnce([mappedPR]);
    fetchMock.mockResolvedValue({ ok: false, status: 403 } as Response);

    await expect(service.getPRs()).resolves.toEqual([mappedPR]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('GitHub: rate limit or forbidden response');
    expect(cache.get.mock.calls).toEqual([['github:prs'], ['github:prs:last-success']]);
  });

  it('negative-caches an empty result when rate limit has no fallback data', async () => {
    cache.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    fetchMock.mockResolvedValue({ ok: false, status: 403 } as Response);

    await expect(service.getPRs()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('GitHub: rate limit or forbidden response');
    expect(cache.set.mock.calls).toEqual([['github:prs', [], 30]]);
  });

  it('returns an empty list and logs when the GitHub API fails', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal error'),
    } as unknown as Response);

    await expect(service.getPRs()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('GitHub API returned 500: Internal error');
    expect(cache.set.mock.calls).toEqual([['github:prs', [], 30]]);
  });

  it('uses a fallback message when the GitHub error body cannot be read', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockRejectedValue(new Error('Body stream failed')),
    } as unknown as Response);

    await expect(service.getPRs()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'GitHub API returned 503: Unable to read GitHub error response',
    );
    expect(cache.set.mock.calls).toEqual([['github:prs', [], 30]]);
  });

  it('returns an empty list when the GitHub request rejects with an Error', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockRejectedValue(new Error('Network failed'));

    await expect(service.getPRs()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('GitHub request failed: Network failed');
    expect(cache.set.mock.calls).toEqual([['github:prs', [], 30]]);
  });

  it('uses a fallback message when the GitHub request rejects with a non-Error value', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockRejectedValue('boom');

    await expect(service.getPRs()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('GitHub request failed: Unknown GitHub error');
    expect(cache.set.mock.calls).toEqual([['github:prs', [], 30]]);
  });

  it('does not call GitHub when configuration is incomplete', async () => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'github.token') return 'github-token';
        return undefined;
      }),
    } as unknown as ConfigService<AppConfiguration, true>;
    service = new GitHubService(config, cache);
    cache.get.mockResolvedValue(null);

    await expect(service.getPRs()).resolves.toEqual([]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith('GitHub: configuration is incomplete');
    expect(cache.set.mock.calls).toEqual([['github:prs', [], 30]]);
  });
});
