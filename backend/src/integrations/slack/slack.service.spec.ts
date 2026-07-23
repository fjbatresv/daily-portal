import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache';
import { SlackMention } from '../../common/types/daily-digest.types';
import { AppConfiguration } from '../../config/configuration';
import { SlackApiMatch, SlackSearchResponse } from './slack.types';
import { SlackService } from './slack.service';

const mappedMention: SlackMention = {
  ts: '1784561400.000000',
  channelName: 'backend',
  senderName: 'ana.garcia',
  text: '<@U123456> cuando estara listo el endpoint?',
  permalink: 'https://tempus.slack.com/archives/C123/p1784561400000000',
};

const slackMatch: SlackApiMatch = {
  ts: '1784561400.000000',
  channel: {
    id: 'C123',
    name: 'backend',
  },
  username: 'ana.garcia',
  text: '<@U123456> cuando estara listo el endpoint?',
  permalink: 'https://tempus.slack.com/archives/C123/p1784561400000000',
};

const slackResponse: SlackSearchResponse = {
  ok: true,
  messages: {
    matches: [slackMatch],
  },
};

describe('SlackService', () => {
  let cache: jest.Mocked<CacheService>;
  let config: ConfigService<AppConfiguration, true>;
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let loggerErrorSpy: jest.SpiedFunction<Logger['error']>;
  let service: SlackService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-20T12:00:00.000Z'));
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;
    config = {
      get: jest.fn((key: string) => {
        if (key === 'slack.userToken') return 'xoxp-token';
        if (key === 'slack.userId') return 'U123456';
        return undefined;
      }),
    } as unknown as ConfigService<AppConfiguration, true>;
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    global.fetch = fetchMock;
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new SlackService(config, cache);
  });

  afterEach(() => {
    jest.useRealTimers();
    loggerErrorSpy.mockRestore();
  });

  it('returns cached mentions without calling Slack', async () => {
    cache.get.mockResolvedValue([mappedMention]);

    await expect(service.getMentions()).resolves.toEqual([mappedMention]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(cache.set.mock.calls).toHaveLength(0);
  });

  it('fetches, maps, filters, and caches Slack mentions on cache miss', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(slackResponse),
    } as unknown as Response);

    await expect(service.getMentions()).resolves.toEqual([mappedMention]);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/search.messages?'),
      expect.objectContaining({
        method: 'GET',
        headers: {
          Authorization: 'Bearer xoxp-token',
          'Content-Type': 'application/json',
        },
      }),
    );
    const [url] = fetchMock.mock.calls[0];
    if (typeof url !== 'string') {
      throw new Error('Expected Slack URL to be a string');
    }
    const searchUrl = new URL(url);
    expect(searchUrl.searchParams.get('query')).toBe('<@U123456> after:2026-07-19');
    expect(searchUrl.searchParams.get('count')).toBe('20');
    expect(searchUrl.searchParams.get('sort')).toBe('timestamp');
    expect(searchUrl.searchParams.get('sort_dir')).toBe('desc');
    expect(cache.set.mock.calls).toEqual([['slack:mentions', [mappedMention], 300]]);
  });

  it('filters out messages older than 24 hours', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        ok: true,
        messages: {
          matches: [
            {
              ...slackMatch,
              ts: '1784462399.000000',
            },
            slackMatch,
          ],
        },
      } satisfies SlackSearchResponse),
    } as unknown as Response);

    await expect(service.getMentions()).resolves.toEqual([mappedMention]);
  });

  it('maps missing optional Slack fields to fallback labels', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        ok: true,
        messages: {
          matches: [
            {
              ts: '1784561400.000000',
              text: 'ping',
              permalink: 'https://tempus.slack.com/archives/C123/p1784561400000000',
            },
          ],
        },
      } satisfies SlackSearchResponse),
    } as unknown as Response);

    await expect(service.getMentions()).resolves.toEqual([
      {
        ts: '1784561400.000000',
        channelName: 'unknown',
        senderName: 'unknown',
        text: 'ping',
        permalink: 'https://tempus.slack.com/archives/C123/p1784561400000000',
      },
    ]);
  });

  it('returns an empty list and logs when Slack returns ok false', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        ok: false,
        error: 'missing_scope',
      } satisfies SlackSearchResponse),
    } as unknown as Response);

    await expect(service.getMentions()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('Slack API error: missing_scope');
    expect(cache.set.mock.calls).toEqual([['slack:mentions', [], 30]]);
  });

  it('uses a fallback Slack error label when ok false has no error', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        ok: false,
      } satisfies SlackSearchResponse),
    } as unknown as Response);

    await expect(service.getMentions()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('Slack API error: unknown_error');
    expect(cache.set.mock.calls).toEqual([['slack:mentions', [], 30]]);
  });

  it('returns an empty list and logs when the Slack API fails', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal error'),
    } as unknown as Response);

    await expect(service.getMentions()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('Slack API returned 500: Internal error');
    expect(cache.set.mock.calls).toEqual([['slack:mentions', [], 30]]);
  });

  it('uses a fallback message when the Slack error body cannot be read', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockRejectedValue(new Error('Body stream failed')),
    } as unknown as Response);

    await expect(service.getMentions()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Slack API returned 503: Unable to read Slack error response',
    );
    expect(cache.set.mock.calls).toEqual([['slack:mentions', [], 30]]);
  });

  it('returns an empty list when the Slack request rejects with an Error', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockRejectedValue(new Error('Network failed'));

    await expect(service.getMentions()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('Slack request failed: Network failed');
    expect(cache.set.mock.calls).toEqual([['slack:mentions', [], 30]]);
  });

  it('uses a fallback message when the Slack request rejects with a non-Error value', async () => {
    cache.get.mockResolvedValue(null);
    fetchMock.mockRejectedValue('boom');

    await expect(service.getMentions()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith('Slack request failed: Unknown Slack error');
    expect(cache.set.mock.calls).toEqual([['slack:mentions', [], 30]]);
  });

  it('does not call Slack when configuration is incomplete', async () => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'slack.userToken') return 'xoxp-token';
        return undefined;
      }),
    } as unknown as ConfigService<AppConfiguration, true>;
    service = new SlackService(config, cache);
    cache.get.mockResolvedValue(null);

    await expect(service.getMentions()).resolves.toEqual([]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith('Slack: configuration is incomplete');
    expect(cache.set.mock.calls).toEqual([['slack:mentions', [], 30]]);
  });
});
