import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'node:fs';
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

    const moduleRef = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(() => sqlitePath),
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

  it('throws when the database handle is read before initialization', () => {
    expect(() => service.instance).toThrow('DatabaseService has not been initialized');
  });

  it('allows shutdown before initialization', () => {
    expect(() => service.onModuleDestroy()).not.toThrow();
  });

  it('exports the database module and service from the barrel', () => {
    expect(DatabaseModule).toBeDefined();
    expect(databaseExports.DatabaseModule).toBe(DatabaseModule);
    expect(databaseExports.DatabaseService).toBe(DatabaseService);
  });
});
