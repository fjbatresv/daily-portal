import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Provides the shared SQLite connection service to persistence repositories.
 */
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
