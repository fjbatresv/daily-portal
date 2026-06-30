import { Controller, DynamicModule, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import configuration from './config/configuration';

@Controller('api/health')
class HealthController {
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

if ((process.env.SERVE_STATIC ?? 'true') === 'true') {
  imports.unshift(
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      exclude: ['/api/(.*)'],
    }),
  );
}

@Module({
  imports,
  controllers: [HealthController],
})
export class AppModule {}
