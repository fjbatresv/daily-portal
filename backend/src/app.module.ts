import { Controller, DynamicModule, Get, Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'node:path';
import { CacheModule } from './common/cache';
import { DatabaseModule } from './common/database';
import configuration from './config/configuration';
import { GitHubModule } from './integrations/github';
import { JiraModule } from './integrations/jira';
import { RemindersModule } from './reminders';
import { SchedulerModule } from './scheduler';
import { TelegramModule } from './telegram';

/**
 * Exposes a small health endpoint for liveness checks and deployment probes.
 */
@Controller('api/health')
class HealthController {
  /**
   * Reports process liveness for Docker and external health checks.
   */
  @Get()
  getHealth(): { status: 'ok'; timestamp: string; uptime: number } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}

const imports: Array<Type<unknown> | DynamicModule | Promise<DynamicModule>> = [
  ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
  ScheduleModule.forRoot(),
  CacheModule,
  DatabaseModule,
  GitHubModule,
  JiraModule,
  RemindersModule,
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
  controllers: [HealthController],
})
export class AppModule {}
