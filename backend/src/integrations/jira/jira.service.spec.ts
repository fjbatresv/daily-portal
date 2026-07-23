import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache';
import { JiraTask } from '../../common/types/daily-digest.types';
import { AppConfiguration } from '../../config/configuration';
import { JiraSearchResponse } from './jira.types';
import { JiraService } from './jira.service';

const mappedTask: JiraTask = {
  id: '10001',
  key: 'TEMP-123',
  summary: 'Implementar autenticacion OAuth',
  status: 'In Progress',
  priority: 'High',
  url: 'https://example.atlassian.net/browse/TEMP-123',
};

const jiraResponse: JiraSearchResponse = {
  issues: [
    {
      id: '10001',
      key: 'TEMP-123',
      fields: {
        summary: 'Implementar autenticacion OAuth',
        status: { name: 'In Progress' },
        priority: { name: 'High' },
      },
    },
  ],
};

describe('JiraService', () => {
  let cache: jest.Mocked<CacheService>;
  let config: ConfigService<AppConfiguration, true>;
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let loggerErrorSpy: jest.SpiedFunction<Logger['error']>;
  let service: JiraService;

  beforeEach(() => {
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;
    config = {
      get: jest.fn((key: string) => {
        if (key === 'jira.baseUrl') return 'https://example.atlassian.net';
        if (key === 'jira.email') return 'user@example.com';
        if (key === 'jira.apiToken') return 'api-token';
        if (key === 'jira.projectKey') return 'TEMP';
        return undefined;
      }),
    } as unknown as ConfigService<AppConfiguration, true>;
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    global.fetch = fetchMock;
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new JiraService(config, cache);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('returns cached tasks without calling Jira', async () => {
    cache.get.mockResolvedValue([mappedTask]);

    await expect(service.getTasks()).resolves.toEqual([mappedTask]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(cache.set.mock.calls).toHaveLength(0);
  });

  it('fetches, maps, and caches Jira tasks on cache miss', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(jiraResponse),
    } as unknown as Response);

    await expect(service.getTasks()).resolves.toEqual([mappedTask]);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://example.atlassian.net/rest/api/3/search?'),
      expect.objectContaining({
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from('user@example.com:api-token').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }),
    );
    const [url] = fetchMock.mock.calls[0];
    if (typeof url !== 'string') {
      throw new Error('Expected Jira URL to be a string');
    }
    const searchUrl = new URL(url);
    expect(searchUrl.searchParams.get('fields')).toBe('summary,status,priority,assignee');
    expect(searchUrl.searchParams.get('maxResults')).toBe('20');
    expect(searchUrl.searchParams.get('jql')).toBe(
      'project=TEMP AND assignee=currentUser() AND statusCategory in ("In Progress","To Do") ORDER BY updated DESC',
    );
    expect(cache.set.mock.calls).toEqual([
      ['jira:tasks', [mappedTask], 900],
      ['jira:tasks:last-success', [mappedTask], 86400],
    ]);
  });

  it('returns an empty list and logs when the Jira API fails', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal error'),
    } as unknown as Response);

    await expect(service.getTasks()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('Jira API returned 500: Internal error');
    expect(cache.set.mock.calls).toEqual([['jira:tasks', [], 30]]);
  });

  it('uses a fallback message when the Jira error body cannot be read', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockRejectedValue(new Error('Body stream failed')),
    } as unknown as Response);

    await expect(service.getTasks()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Jira API returned 503: Unable to read Jira error response',
    );
    expect(cache.set.mock.calls).toEqual([['jira:tasks', [], 30]]);
  });

  it('returns an empty list when the Jira request rejects with an Error', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockRejectedValue(new Error('Network failed'));

    await expect(service.getTasks()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('Jira request failed: Network failed');
    expect(cache.set.mock.calls).toEqual([['jira:tasks', [], 30]]);
  });

  it('uses a fallback message when the Jira request rejects with a non-Error value', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockRejectedValue('boom');

    await expect(service.getTasks()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('Jira request failed: Unknown Jira error');
    expect(cache.set.mock.calls).toEqual([['jira:tasks', [], 30]]);
  });

  it('maps missing priority to an explicit fallback value', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        issues: [
          {
            id: '10002',
            key: 'TEMP-124',
            fields: {
              summary: 'Tarea sin prioridad',
              status: { name: 'To Do' },
              priority: null,
            },
          },
        ],
      } satisfies JiraSearchResponse),
    } as unknown as Response);

    await expect(service.getTasks()).resolves.toEqual([
      {
        id: '10002',
        key: 'TEMP-124',
        summary: 'Tarea sin prioridad',
        status: 'To Do',
        priority: 'Unprioritized',
        url: 'https://example.atlassian.net/browse/TEMP-124',
      },
    ]);
  });

  it('returns an empty list for invalid credentials', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(service.getTasks()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('Jira: credenciales inválidas');
    expect(cache.set.mock.calls).toEqual([['jira:tasks', [], 30]]);
  });

  it('returns fallback cached data on rate limit when available', async () => {
    cache.get.mockResolvedValueOnce(null).mockResolvedValueOnce([mappedTask]);
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response);

    await expect(service.getTasks()).resolves.toEqual([mappedTask]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('Jira: rate limit');
    expect(cache.get.mock.calls).toEqual([['jira:tasks'], ['jira:tasks:last-success']]);
  });

  it('negative-caches an empty result when rate limit has no fallback data', async () => {
    cache.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response);

    await expect(service.getTasks()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('Jira: rate limit');
    expect(cache.set.mock.calls).toEqual([['jira:tasks', [], 30]]);
  });

  it('does not call Jira when configuration is incomplete', async () => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'jira.baseUrl') return 'https://example.atlassian.net';
        return undefined;
      }),
    } as unknown as ConfigService<AppConfiguration, true>;
    service = new JiraService(config, cache);
    cache.get.mockResolvedValue(null);

    await expect(service.getTasks()).resolves.toEqual([]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith('Jira: configuration is incomplete');
    expect(cache.set.mock.calls).toEqual([['jira:tasks', [], 30]]);
  });
});
