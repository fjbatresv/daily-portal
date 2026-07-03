import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

/**
 * Wires cron scheduling and manual digest triggering.
 */
@Module({
  imports: [TelegramModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
