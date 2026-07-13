import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { DailyDigest } from '../common/types/daily-digest.types';
import { AppConfiguration } from '../config/configuration';
import { TelegramService } from '../telegram';
import { DAILY_DIGEST_BUILDER, DailyDigestBuilder } from './daily-digest-builder';

const morningDigestJobName = 'morning-digest';

/**
 * Runs the configured morning digest workflow and manual dev trigger.
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Optional()
    @Inject(DAILY_DIGEST_BUILDER)
    private readonly aggregator?: DailyDigestBuilder,
  ) {}

  /**
   * Registers the configured morning digest cron job.
   */
  onModuleInit(): void {
    const job = CronJob.from({
      cronTime: this.config.get('morningDigestCron', { infer: true }),
      onTick: () => {
        void this.runMorningDigest();
      },
      start: false,
      timeZone: this.config.get('tz', { infer: true }),
    });

    this.schedulerRegistry.addCronJob(morningDigestJobName, job);
    job.start();
  }

  /**
   * Removes the registered cron job during shutdown.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.schedulerRegistry.doesExist('cron', morningDigestJobName)) {
      await this.schedulerRegistry.getCronJob(morningDigestJobName).stop();
      this.schedulerRegistry.deleteCronJob(morningDigestJobName);
    }
  }

  /**
   * Executes the morning digest workflow without allowing failures to crash the process.
   */
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
