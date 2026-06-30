import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfiguration } from './config/configuration';

/**
 * Bootstraps the NestJS HTTP server.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const config = app.get<ConfigService<AppConfiguration, true>>(ConfigService);
  const port = config.getOrThrow('port', { infer: true });
  await app.listen(port);
}

void bootstrap();
