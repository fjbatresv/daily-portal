import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Provides Redis-backed cache access for external integration modules.
 */
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
