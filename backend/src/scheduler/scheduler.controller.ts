import { Controller, Post } from '@nestjs/common';
import { DailyDigest } from '../common/types/daily-digest.types';
import { SchedulerService } from './scheduler.service';

/**
 * Provides the development-only manual digest trigger endpoint.
 */
@Controller('api/scheduler')
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  /**
   * Triggers the digest workflow outside the cron schedule.
   */
  @Post('trigger')
  triggerManual(): Promise<DailyDigest> {
    return this.scheduler.triggerManual();
  }
}
