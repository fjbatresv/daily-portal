import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DailyDigest } from '../common/types/daily-digest.types';
import { AppConfiguration } from '../config/configuration';
import { NotificationLogsRepository } from './notification-logs.repository';
import { TelegramFormatter } from './telegram-formatter.service';
import { TelegramService } from './telegram.service';

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
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let notificationLogs: jest.Mocked<NotificationLogsRepository>;
  let service: TelegramService;
  let loggerErrorSpy: jest.SpiedFunction<Logger['error']>;

  beforeEach(() => {
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    global.fetch = fetchMock;
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
    fetchMock.mockResolvedValue({ ok: true, status: 200 } as Response);

    await service.sendMorningDigest(digest);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(notificationLogs.create.mock.calls).toEqual([['success', undefined]]);
  });

  it('logs errors and does not throw when Telegram fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 } as Response);

    await expect(service.sendMorningDigest(digest)).resolves.toBeUndefined();

    expect(notificationLogs.create.mock.calls).toEqual([['error', 'Telegram API returned 400']]);
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('sends escaped test messages without inserting notification logs', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 } as Response);

    await service.sendTestMessage('Hello!');

    expect(fetchMock).toHaveBeenCalled();
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('truncates messages longer than the Telegram limit', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 } as Response);

    await service.sendMorningDigest({
      ...digest,
      todoList: [{ source: 'reminder', priority: 'low', text: 'x'.repeat(5000) }],
    });

    const [, init] = fetchMock.mock.calls[0];
    if (!init || typeof init.body !== 'string') {
      throw new Error('Expected Telegram request body to be a JSON string');
    }
    const body = JSON.parse(init.body) as { text: string };
    expect(body.text.length).toBeLessThanOrEqual(4096);
  });

  it('logs timeout failures without throwing', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'));

    await expect(service.sendMorningDigest(digest)).resolves.toBeUndefined();

    expect(notificationLogs.create.mock.calls).toEqual([['error', 'The operation timed out']]);
  });
});
