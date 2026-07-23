import { Module } from '@nestjs/common';
import { CacheModule } from '../common/cache';
import { GitHubModule } from '../integrations/github';
import { GoogleCalendarModule } from '../integrations/google-calendar';
import { JiraModule } from '../integrations/jira';
import { SlackModule } from '../integrations/slack';
import { RemindersModule } from '../reminders';
import { DAILY_DIGEST_BUILDER } from '../scheduler/daily-digest-builder';
import { DailyAggregatorService } from './daily-aggregator.service';
import { DashboardController } from './dashboard.controller';

/**
 * Wires the digest aggregator, dashboard API, and scheduler-facing digest builder token.
 */
@Module({
  imports: [
    CacheModule,
    GitHubModule,
    GoogleCalendarModule,
    JiraModule,
    SlackModule,
    RemindersModule,
  ],
  controllers: [DashboardController],
  providers: [
    DailyAggregatorService,
    {
      provide: DAILY_DIGEST_BUILDER,
      useExisting: DailyAggregatorService,
    },
  ],
  exports: [DailyAggregatorService, DAILY_DIGEST_BUILDER],
})
export class DashboardModule {}
