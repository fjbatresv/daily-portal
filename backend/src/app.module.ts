import { Controller, DynamicModule, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import configuration from './config/configuration';

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

const imports: Array<DynamicModule | Promise<DynamicModule>> = [
  ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
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
