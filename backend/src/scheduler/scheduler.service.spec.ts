import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DailyDigest } from '../common/types/daily-digest.types';
import { AppConfiguration } from '../config/configuration';
import { TelegramService } from '../telegram';
import { DailyDigestBuilder } from './daily-digest-builder';
import { SchedulerService } from './scheduler.service';

const digest: DailyDigest = {
  date: '2026-06-29',
  generatedAt: '2026-06-29T14:00:00.000Z',
  todoList: [],
  tasks: [],
  prs: [],
  events: [],
  slackMentions: [],
  reminders: [],
};

describe('SchedulerService', () => {
  let aggregator: jest.Mocked<DailyDigestBuilder>;
  let telegram: jest.Mocked<TelegramService>;
  let config: ConfigService<AppConfiguration, true>;
  let loggerErrorSpy: jest.SpiedFunction<Logger['error']>;

  beforeEach(() => {
    aggregator = {
      buildDailyDigest: jest.fn<Promise<DailyDigest>, []>().mockResolvedValue(digest),
    };
    telegram = {
      sendMorningDigest: jest.fn<Promise<void>, [DailyDigest]>().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TelegramService>;
    config = {
      get: jest.fn((key: string) => (key === 'nodeEnv' ? 'development' : undefined)),
    } as unknown as ConfigService<AppConfiguration, true>;
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('runs the morning digest workflow', async () => {
    const service = new SchedulerService(telegram, config, aggregator);

    await service.runMorningDigest();

    expect(aggregator.buildDailyDigest.mock.calls).toHaveLength(1);
    expect(telegram.sendMorningDigest.mock.calls).toEqual([[digest]]);
  });

  it('does not rethrow when the aggregator fails', async () => {
    aggregator.buildDailyDigest.mockRejectedValue(new Error('Aggregator failed'));
    const service = new SchedulerService(telegram, config, aggregator);

    await expect(service.runMorningDigest()).resolves.toBeUndefined();

    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('does not rethrow when Telegram fails', async () => {
    telegram.sendMorningDigest.mockRejectedValue(new Error('Telegram failed'));
    const service = new SchedulerService(telegram, config, aggregator);

    await expect(service.runMorningDigest()).resolves.toBeUndefined();

    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('returns the digest from the manual development trigger', async () => {
    const service = new SchedulerService(telegram, config, aggregator);

    await expect(service.triggerManual()).resolves.toBe(digest);
  });

  it('disables the manual trigger in production', async () => {
    config = {
      get: jest.fn((key: string) => (key === 'nodeEnv' ? 'production' : undefined)),
    } as unknown as ConfigService<AppConfiguration, true>;
    const service = new SchedulerService(telegram, config, aggregator);

    await expect(service.triggerManual()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('uses an empty fallback digest when no digest builder has been registered yet', async () => {
    const service = new SchedulerService(telegram, config);

    await expect(service.runMorningDigest()).resolves.toBeUndefined();

    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(telegram.sendMorningDigest.mock.calls[0]?.[0]).toMatchObject({
      todoList: [],
      tasks: [],
      prs: [],
      events: [],
      slackMentions: [],
      reminders: [],
    });
  });
});
