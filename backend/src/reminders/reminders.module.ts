import { Module } from '@nestjs/common';
import { DatabaseModule } from '../common/database';
import { RemindersController } from './reminders.controller';
import { RemindersRepository } from './reminders.repository';
import { RemindersService } from './reminders.service';

/**
 * Groups reminder persistence, business logic, and HTTP endpoints.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersRepository],
  exports: [RemindersService],
})
export class RemindersModule {}
