import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from '../common/database';
import { NotificationLogsRepository } from './notification-logs.repository';

describe('NotificationLogsRepository', () => {
  let tempDir: string;
  let db: Database.Database;
  let repository: NotificationLogsRepository;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'daily-portal-notifications-'));
    db = new Database(join(tempDir, 'portal.db'));
    db.exec(readFileSync(join(process.cwd(), '../db/schema.sql'), 'utf8'));
    repository = new NotificationLogsRepository({ instance: db } as DatabaseService);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('inserts notification log rows', () => {
    expect(repository.create('error', 'Telegram failed')).toMatchObject({
      status: 'error',
      error_msg: 'Telegram failed',
    });
  });
});
