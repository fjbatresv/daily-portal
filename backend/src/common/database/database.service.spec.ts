import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as databaseExports from './index';
import { DatabaseModule } from './database.module';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let tempDir: string;
  let service: DatabaseService;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'daily-portal-db-'));
    const sqlitePath = join(tempDir, 'portal.db');
    const schemaPath = join(tempDir, 'schema.sql');
    writeFileSync(
      schemaPath,
      'CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, text TEXT NOT NULL);\n',
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'sqlite.path') {
                return sqlitePath;
              }

              if (key === 'sqlite.schemaPath') {
                return schemaPath;
              }

              throw new Error(`Unexpected config key: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DatabaseService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates the SQLite database, enables WAL, and runs schema migrations', () => {
    service.onModuleInit();

    const journalMode = service.instance.pragma('journal_mode', {
      simple: true,
    });
    const reminderTable = service.instance
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reminders'")
      .get();

    expect(journalMode).toBe('wal');
    expect(reminderTable).toEqual({ name: 'reminders' });
  });

  it('migrates legacy notification logs to the current shape', async () => {
    const sqlitePath = join(tempDir, 'legacy-portal.db');
    const schemaPath = join(tempDir, 'legacy-schema.sql');
    writeFileSync(
      schemaPath,
      `
      CREATE TABLE IF NOT EXISTS notification_logs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        status TEXT NOT NULL CHECK (status IN ('success', 'error')),
        error_msg TEXT,
        sent_at TEXT DEFAULT (datetime('now'))
      );
      `,
    );
    const legacyService = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'sqlite.path') {
                return sqlitePath;
              }

              if (key === 'sqlite.schemaPath') {
                return schemaPath;
              }

              throw new Error(`Unexpected config key: ${key}`);
            }),
          },
        },
      ],
    }).compile();
    const database = legacyService.get(DatabaseService);
    database.onModuleInit();
    database.instance.exec(`
      DROP TABLE notification_logs;
      CREATE TABLE notification_logs (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
        message TEXT,
        error TEXT,
        sent_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO notification_logs (id, channel, status, error, sent_at)
      VALUES ('log-1', 'telegram', 'failed', 'Bad chat', '2026-06-29 08:00:00');
      INSERT INTO notification_logs (id, channel, status, error, sent_at)
      VALUES ('log-2', 'telegram', 'sent', NULL, '2026-06-29 09:00:00');
    `);
    database.onModuleDestroy();

    database.onModuleInit();

    expect(
      database.instance
        .prepare('SELECT status, error_msg FROM notification_logs WHERE id = ?')
        .get('log-1'),
    ).toEqual({ status: 'error', error_msg: 'Bad chat' });
    expect(
      database.instance
        .prepare('SELECT status, error_msg FROM notification_logs WHERE id = ?')
        .get('log-2'),
    ).toEqual({ status: 'success', error_msg: null });
    database.onModuleDestroy();
    await legacyService.close();
  });

  it('throws when the database handle is read before initialization', () => {
    expect(() => service.instance).toThrow('DatabaseService has not been initialized');
  });

  it('allows shutdown before initialization', () => {
    expect(() => service.onModuleDestroy()).not.toThrow();
  });

  it('throws when the configured schema file is missing', async () => {
    const sqlitePath = join(tempDir, 'missing-schema.db');
    const schemaPath = join(tempDir, 'missing-schema.sql');
    const moduleRef = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'sqlite.path') {
                return sqlitePath;
              }

              if (key === 'sqlite.schemaPath') {
                return schemaPath;
              }

              throw new Error(`Unexpected config key: ${key}`);
            }),
          },
        },
      ],
    }).compile();
    const missingSchemaService = moduleRef.get(DatabaseService);

    expect(() => missingSchemaService.onModuleInit()).toThrow(
      `SQLite schema file not found: ${schemaPath}`,
    );
    missingSchemaService.onModuleDestroy();
  });

  it('exports the database module and service from the barrel', () => {
    expect(DatabaseModule).toBeDefined();
    expect(databaseExports.DatabaseModule).toBe(DatabaseModule);
    expect(databaseExports.DatabaseService).toBe(DatabaseService);
  });
});
