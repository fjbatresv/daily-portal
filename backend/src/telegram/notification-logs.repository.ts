import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database';

export interface NotificationLogRow {
  id: string;
  status: 'success' | 'error';
  error_msg: string | null;
  sent_at: string;
}

/**
 * Owns persistence for Telegram notification delivery logs.
 */
@Injectable()
export class NotificationLogsRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Inserts a notification delivery log row.
   */
  create(status: 'success' | 'error', errorMsg?: string): NotificationLogRow {
    return this.db.instance
      .prepare(
        `INSERT INTO notification_logs (status, error_msg)
         VALUES (?, ?)
         RETURNING *`,
      )
      .get(status, errorMsg ?? null) as NotificationLogRow;
  }
}
