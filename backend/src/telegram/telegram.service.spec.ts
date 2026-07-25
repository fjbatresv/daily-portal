import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DailyDigest } from '../common/types/daily-digest.types';
import { AppConfiguration } from '../config/configuration';
import { AxiosPostMock, axiosResponse, getAxiosMock } from '../../test/axios-test-utils';
import { NotificationLogsRepository } from './notification-logs.repository';
import { TelegramFormatter } from './telegram-formatter.service';
import { TelegramService } from './telegram.service';

jest.mock('axios');

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

describe('TelegramService', () => {
  let axiosPostMock: AxiosPostMock;
  let notificationLogs: jest.Mocked<NotificationLogsRepository>;
  let service: TelegramService;
  let loggerErrorSpy: jest.SpiedFunction<Logger['error']>;

  beforeEach(() => {
    axiosPostMock = getAxiosMock('post').post;
    axiosPostMock.mockReset();
    notificationLogs = {
      create: jest.fn(),
    } as unknown as jest.Mocked<NotificationLogsRepository>;
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'telegram.botToken') return 'bot-token';
        if (key === 'telegram.chatId') return 'chat-id';
        return undefined;
      }),
    } as unknown as ConfigService<AppConfiguration, true>;
    service = new TelegramService(config, new TelegramFormatter(), notificationLogs);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('sends morning digest messages and logs success', async () => {
    axiosPostMock.mockResolvedValue(axiosResponse(200, { ok: true }));

    await service.sendMorningDigest(digest);

    expect(axiosPostMock).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/sendMessage',
      expect.objectContaining({
        chat_id: 'chat-id',
        parse_mode: 'MarkdownV2',
      }),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
        timeout: 10_000,
      }),
    );
    expect(notificationLogs.create.mock.calls).toEqual([['success', undefined]]);
  });

  it('logs errors and does not throw when Telegram fails', async () => {
    axiosPostMock.mockResolvedValue(axiosResponse(400, { ok: false }));

    await expect(service.sendMorningDigest(digest)).resolves.toBeUndefined();

    expect(notificationLogs.create.mock.calls).toEqual([['error', 'Telegram API returned 400']]);
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('sends escaped test messages without inserting notification logs', async () => {
    axiosPostMock.mockResolvedValue(axiosResponse(200, { ok: true }));

    await service.sendTestMessage('Hello!');

    expect(axiosPostMock).toHaveBeenCalled();
    expect(notificationLogs.create.mock.calls).toHaveLength(0);
  });

  it('logs errors when credentials are missing', async () => {
    const config = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService<AppConfiguration, true>;
    service = new TelegramService(config, new TelegramFormatter(), notificationLogs);

    await expect(service.sendMorningDigest(digest)).resolves.toBeUndefined();

    expect(notificationLogs.create.mock.calls).toEqual([
      ['error', 'Telegram credentials are not configured'],
    ]);
    expect(axiosPostMock).not.toHaveBeenCalled();
  });

  it('truncates messages longer than the Telegram limit', async () => {
    axiosPostMock.mockResolvedValue(axiosResponse(200, { ok: true }));

    await service.sendMorningDigest({
      ...digest,
      todoList: [{ source: 'reminder', priority: 'low', text: 'x'.repeat(5000) }],
    });

    const [, body] = axiosPostMock.mock.calls[0];
    if (!isTelegramBody(body)) {
      throw new Error('Expected Telegram request body to match the sendMessage payload');
    }
    expect(body.text.length).toBeLessThanOrEqual(4096);
  });

  it('logs timeout failures without throwing', async () => {
    axiosPostMock.mockRejectedValue(new Error('timeout of 10000ms exceeded'));

    await expect(service.sendMorningDigest(digest)).resolves.toBeUndefined();

    expect(notificationLogs.create.mock.calls).toEqual([['error', 'timeout of 10000ms exceeded']]);
  });
});

function isTelegramBody(value: unknown): value is { text: string } {
  return (
    typeof value === 'object' && value !== null && 'text' in value && typeof value.text === 'string'
  );
}
