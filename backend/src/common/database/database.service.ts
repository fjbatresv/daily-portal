import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AppConfiguration } from '../../config/configuration';

const notificationLogsTableSql = `
CREATE TABLE notification_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_msg TEXT,
  sent_at TEXT DEFAULT (datetime('now'))
)`;

interface TableInfoRow {
  name: string;
}

interface TableSqlRow {
  sql: string;
}

/**
 * Owns the application SQLite connection lifecycle and schema initialization.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db?: Database.Database;

  constructor(private readonly config: ConfigService<AppConfiguration, true>) {}

  /**
   * Opens the SQLite database, enables WAL mode, and applies the current schema.
   */
  onModuleInit(): void {
    const sqlitePath = this.config.getOrThrow('sqlite.path', { infer: true });
    mkdirSync(dirname(sqlitePath), { recursive: true });

    this.db = new Database(sqlitePath);
    this.db.pragma('journal_mode = WAL');
    this.runMigrations();
  }

  /**
   * Closes the SQLite connection when NestJS shuts down the module.
   */
  onModuleDestroy(): void {
    if (this.db?.open) {
      this.db.close();
    }
  }

  /**
   * Returns the initialized better-sqlite3 database handle for repositories.
   */
  get instance(): Database.Database {
    if (!this.db) {
      throw new Error('DatabaseService has not been initialized');
    }

    return this.db;
  }

  private runMigrations(): void {
    const schema = readFileSync(this.resolveSchemaPath(), 'utf8');
    this.instance.exec(schema);
    this.migrateNotificationLogs();
    this.logger.log('SQLite schema initialized');
  }

  private migrateNotificationLogs(): void {
    const table = this.instance
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'notification_logs'")
      .get() as TableSqlRow | undefined;

    if (!table) {
      return;
    }

    const columns = (this.instance.pragma('table_info(notification_logs)') as TableInfoRow[]).map(
      (column) => column.name,
    );
    if (table.sql.includes("status IN ('success', 'error')") && columns.includes('error_msg')) {
      return;
    }

    const errorExpression = columns.includes('error_msg')
      ? 'error_msg'
      : columns.includes('error')
        ? 'error'
        : columns.includes('message')
          ? 'message'
          : 'NULL';

    this.instance.transaction(() => {
      this.instance.exec('ALTER TABLE notification_logs RENAME TO notification_logs_legacy');
      this.instance.exec(notificationLogsTableSql);
      this.instance
        .prepare(
          `INSERT INTO notification_logs (id, status, error_msg, sent_at)
             SELECT
               id,
               CASE status
                 WHEN 'sent' THEN 'success'
                 WHEN 'failed' THEN 'error'
                 WHEN 'success' THEN 'success'
                 ELSE 'error'
               END,
               ${errorExpression},
               sent_at
             FROM notification_logs_legacy`,
        )
        .run();
      this.instance.exec('DROP TABLE notification_logs_legacy');
    })();
  }

  private resolveSchemaPath(): string {
    const schemaPath = this.config.getOrThrow('sqlite.schemaPath', { infer: true });

    if (!schemaPath) {
      throw new Error('SQLite schema path is not configured');
    }

    if (!existsSync(schemaPath)) {
      throw new Error(`SQLite schema file not found: ${schemaPath}`);
    }

    return schemaPath;
  }
}
