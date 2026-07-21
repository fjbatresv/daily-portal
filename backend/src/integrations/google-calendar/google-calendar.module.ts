import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache';
import { GoogleCalendarService } from './google-calendar.service';

/**
 * Provides access to Google Calendar events through the cached integration service.
 */
@Module({
  imports: [CacheModule],
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
