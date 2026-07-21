import { DynamicModule, Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'node:path';
import { CacheModule } from './common/cache';
import { DatabaseModule } from './common/database';
import configuration from './config/configuration';
import { DashboardModule } from './dashboard';
import { GitHubModule } from './integrations/github';
import { GoogleCalendarModule } from './integrations/google-calendar';
import { JiraModule } from './integrations/jira';
import { SlackModule } from './integrations/slack';
import { RemindersModule } from './reminders';
import { SchedulerModule } from './scheduler';
import { TelegramModule } from './telegram';

const imports: Array<Type<unknown> | DynamicModule | Promise<DynamicModule>> = [
  ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
  ScheduleModule.forRoot(),
  CacheModule,
  DatabaseModule,
  GitHubModule,
  GoogleCalendarModule,
  JiraModule,
  SlackModule,
  RemindersModule,
  DashboardModule,
  TelegramModule,
  SchedulerModule,
];

if (configuration().serveStatic) {
  imports.unshift(
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      exclude: ['/api/(.*)'],
    }),
  );
}

/**
 * Root NestJS module for the current scaffold.
 */
@Module({
  imports,
})
export class AppModule {}
