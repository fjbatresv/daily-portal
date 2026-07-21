import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache';
import { GitHubService } from './github.service';

/**
 * Provides GitHub integration services to the rest of the backend.
 */
@Module({
  imports: [CacheModule],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}
