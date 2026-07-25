import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DailyDigest } from '../common/types/daily-digest.types';
import { AppConfiguration } from '../config/configuration';
import { NotificationLogsRepository } from './notification-logs.repository';
import { TelegramFormatter } from './telegram-formatter.service';

interface TelegramSendMessageBody {
  chat_id: string;
  text: string;
  parse_mode: 'MarkdownV2';
  disable_web_page_preview: boolean;
}

interface TelegramSendMessageResponse {
  ok: boolean;
  description?: string;
}

/**
 * Sends Telegram Bot API messages and records delivery outcomes.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly requestTimeoutMs = 10_000;

  constructor(
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly formatter: TelegramFormatter,
    private readonly notificationLogs: NotificationLogsRepository,
  ) {}

  /**
   * Formats and sends the morning digest without propagating Telegram failures.
   */
  async sendMorningDigest(digest: DailyDigest): Promise<void> {
    const message = this.truncate(this.formatter.format(digest));
    await this.sendMessage(message, true);
  }

  /**
   * Sends a plain test message through the same Telegram configuration.
   */
  async sendTestMessage(text: string): Promise<void> {
    await this.sendMessage(this.formatter.escape(text), false);
  }

  private async sendMessage(text: string, logNotification: boolean): Promise<void> {
    try {
      const botToken = this.config.get('telegram.botToken', { infer: true });
      const chatId = this.config.get('telegram.chatId', { infer: true });

      if (!botToken || !chatId) {
        throw new Error('Telegram credentials are not configured');
      }

      const body: TelegramSendMessageBody = {
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      };

      const response = await axios.post<TelegramSendMessageResponse>(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        body,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.requestTimeoutMs,
          validateStatus: () => true,
        },
      );

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Telegram API returned ${response.status}`);
      }

      if (logNotification) {
        this.insertLog('success');
      }
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Telegram message failed: ${message}`);

      if (logNotification) {
        this.insertLog('error', message);
      }
    }
  }

  private insertLog(status: 'success' | 'error', errorMsg?: string): void {
    this.notificationLogs.create(status, errorMsg);
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }

    return 'Unknown Telegram error';
  }

  private truncate(message: string): string {
    const maxTelegramLength = 4096;
    if (message.length <= maxTelegramLength) {
      return message;
    }

    return `${message.slice(0, maxTelegramLength - 30)}\n${this.formatter.escape('... mensaje truncado')}`;
  }
}
