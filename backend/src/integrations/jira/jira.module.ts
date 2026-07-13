import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache';
import { JiraService } from './jira.service';

/**
 * Provides Jira integration services to the rest of the backend.
 */
@Module({
  imports: [CacheModule],
  providers: [JiraService],
  exports: [JiraService],
})
export class JiraModule {}
