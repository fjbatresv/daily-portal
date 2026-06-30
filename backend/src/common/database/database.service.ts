import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AppConfiguration } from '../../config/configuration';

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
    this.logger.log('SQLite schema initialized');
  }

  private resolveSchemaPath(): string {
    const candidates = [
      join(__dirname, '../../../../db/schema.sql'),
      join(process.cwd(), 'db/schema.sql'),
      join(process.cwd(), '../db/schema.sql'),
    ];

    const schemaPath = candidates.find((candidate) => existsSync(candidate));
    if (!schemaPath) {
      throw new Error(`SQLite schema file not found. Checked: ${candidates.join(', ')}`);
    }

    return schemaPath;
  }
}
