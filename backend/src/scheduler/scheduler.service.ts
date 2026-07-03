import { Inject, Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DailyDigest } from '../common/types/daily-digest.types';
import { AppConfiguration } from '../config/configuration';
import { TelegramService } from '../telegram';
import { DAILY_DIGEST_BUILDER, DailyDigestBuilder } from './daily-digest-builder';

/**
 * Runs the configured morning digest workflow and manual dev trigger.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService<AppConfiguration, true>,
    @Optional()
    @Inject(DAILY_DIGEST_BUILDER)
    private readonly aggregator?: DailyDigestBuilder,
  ) {}

  /**
   * Executes the morning digest cron without allowing failures to crash the process.
   */
  @Cron(process.env.MORNING_DIGEST_CRON ?? '0 8 * * *', {
    timeZone: process.env.TZ ?? 'America/Guatemala',
  })
  async runMorningDigest(): Promise<void> {
    this.logger.log('Starting morning digest...');

    try {
      const digest = await this.buildDailyDigest();
      await this.telegram.sendMorningDigest(digest);
      this.logger.log(`Morning digest sent. TODO items: ${digest.todoList.length}`);
    } catch (error) {
      this.logger.error('Morning digest failed', error);
    }
  }

  /**
   * Runs the same workflow for the development-only HTTP trigger.
   */
  async triggerManual(): Promise<DailyDigest> {
    if (this.config.get('nodeEnv', { infer: true }) === 'production') {
      throw new ServiceUnavailableException('Manual scheduler trigger is disabled in production');
    }

    const digest = await this.buildDailyDigest();
    await this.telegram.sendMorningDigest(digest);
    return digest;
  }

  private async buildDailyDigest(): Promise<DailyDigest> {
    if (!this.aggregator) {
      const now = new Date();
      return {
        date: now.toISOString().slice(0, 10),
        generatedAt: now.toISOString(),
        todoList: [],
        tasks: [],
        prs: [],
        events: [],
        slackMentions: [],
        reminders: [],
      };
    }

    return this.aggregator.buildDailyDigest();
  }
}
