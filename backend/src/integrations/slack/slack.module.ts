import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache';
import { SlackService } from './slack.service';

/**
 * Provides Slack integration services to the rest of the backend.
 */
@Module({
  imports: [CacheModule],
  providers: [SlackService],
  exports: [SlackService],
})
export class SlackModule {}
