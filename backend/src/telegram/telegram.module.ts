import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database';
import { NotificationLogsRepository } from './notification-logs.repository';
import { TelegramFormatter } from './telegram-formatter.service';
import { TelegramService } from './telegram.service';

/**
 * Provides Telegram digest formatting, delivery, and notification logging.
 */
@Module({
  imports: [DatabaseModule],
  providers: [TelegramService, TelegramFormatter, NotificationLogsRepository],
  exports: [TelegramService],
})
export class TelegramModule {}
