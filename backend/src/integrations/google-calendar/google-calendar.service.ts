import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { CacheService } from '../../common/cache';
import { CalendarEvent } from '../../common/types/daily-digest.types';
import { AppConfiguration } from '../../config/configuration';
import {
  GoogleCalendarApi,
  GoogleCalendarEntryPoint,
  GoogleCalendarEvent,
  GoogleCalendarEventDateTime,
} from './google-calendar.types';

interface GoogleCalendarConfig {
  calendarIds: string[];
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Reads today's events from configured Google calendars through OAuth2 with Redis caching.
 */
@Injectable()
export class GoogleCalendarService implements OnModuleInit {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly cacheKey = 'gcal:events';
  private readonly cacheTtlSeconds = 10 * 60;
  private readonly negativeCacheTtlSeconds = 30;
  private readonly calendarNames = new Map<string, string>();
  private calendar?: GoogleCalendarApi;

  constructor(
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly cache: CacheService,
  ) {}

  /**
   * Initializes the Google Calendar API client when OAuth2 configuration is available.
   */
  onModuleInit(): void {
    const googleCalendarConfig = this.getGoogleCalendarConfig();

    if (!googleCalendarConfig) {
      return;
    }

    const auth = new google.auth.OAuth2(
      googleCalendarConfig.clientId,
      googleCalendarConfig.clientSecret,
    );
    auth.setCredentials({ refresh_token: googleCalendarConfig.refreshToken });
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  /**
   * Returns today's events across all configured calendars, preserving partial data on failures.
   */
  async getEvents(): Promise<CalendarEvent[]> {
    const cachedEvents = await this.cache.get<CalendarEvent[]>(this.cacheKey);

    if (cachedEvents) {
      return cachedEvents;
    }

    const googleCalendarConfig = this.getGoogleCalendarConfig();
    if (!googleCalendarConfig || !this.calendar) {
      await this.cacheEmptyEvents();
      return [];
    }

    const results = await Promise.allSettled(
      googleCalendarConfig.calendarIds.map((calendarId) => this.getCalendarEvents(calendarId)),
    );
    const events = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      this.logCalendarError(googleCalendarConfig.calendarIds[index], result.reason);
      return [];
    });

    events.sort((a, b) => a.startTime.localeCompare(b.startTime));
    await this.cache.set(this.cacheKey, events, this.cacheTtlSeconds);

    return events;
  }

  private getGoogleCalendarConfig(): GoogleCalendarConfig | null {
    const clientId = this.config.get('googleCalendar.clientId', { infer: true });
    const clientSecret = this.config.get('googleCalendar.clientSecret', { infer: true });
    const refreshToken = this.config.get('googleCalendar.refreshToken', { infer: true });
    const calendarIds = this.config.get('googleCalendar.calendarIds', { infer: true });

    if (!clientId || !clientSecret || !refreshToken || calendarIds.length === 0) {
      this.logger.error('Google Calendar: configuration is incomplete');
      return null;
    }

    return {
      calendarIds,
      clientId,
      clientSecret,
      refreshToken,
    };
  }

  private async getCalendarEvents(calendarId: string): Promise<CalendarEvent[]> {
    const calendarName = await this.getCalendarName(calendarId);
    const { timeMin, timeMax } = this.getTodayBounds();
    const response = await this.requireCalendar().events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    });

    return (response.data.items ?? []).map((event) =>
      this.mapEvent(event, calendarId, calendarName),
    );
  }

  private async getCalendarName(calendarId: string): Promise<string> {
    const cachedCalendarName = this.calendarNames.get(calendarId);

    if (cachedCalendarName) {
      return cachedCalendarName;
    }

    const response = await this.requireCalendar().calendars.get({ calendarId });
    const calendarName = response.data.summary ?? calendarId;
    this.calendarNames.set(calendarId, calendarName);

    return calendarName;
  }

  private getTodayBounds(): { timeMax: string; timeMin: string } {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    return {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
    };
  }

  private mapEvent(
    event: GoogleCalendarEvent,
    calendarId: string,
    calendarName: string,
  ): CalendarEvent {
    const start = this.mapEventDateTime(event.start, 'start');
    const end = this.mapEventDateTime(event.end, 'end');

    return {
      id: event.id ?? `${calendarId}:${start.value}:${event.summary ?? 'untitled'}`,
      title: event.summary ?? '(sin titulo)',
      startTime: start.value,
      endTime: end.value,
      calendarId,
      calendarName,
      isAllDay: start.isAllDay,
      meetUrl: this.getMeetUrl(event),
    };
  }

  private mapEventDateTime(
    dateTime: GoogleCalendarEventDateTime | undefined,
    boundary: 'end' | 'start',
  ): { isAllDay: boolean; value: string } {
    if (dateTime?.dateTime) {
      return { isAllDay: false, value: dateTime.dateTime };
    }

    if (dateTime?.date) {
      const date =
        boundary === 'end' ? this.getInclusiveAllDayEndDate(dateTime.date) : dateTime.date;

      return {
        isAllDay: true,
        value: `${date}T${boundary === 'start' ? '00:00:00' : '23:59:59'}`,
      };
    }

    const now = new Date().toISOString();
    return { isAllDay: false, value: now };
  }

  private getMeetUrl(event: GoogleCalendarEvent): string | undefined {
    return (
      event.hangoutLink ??
      event.conferenceData?.entryPoints?.find((entryPoint: GoogleCalendarEntryPoint) => {
        return entryPoint.entryPointType === 'video' && Boolean(entryPoint.uri);
      })?.uri ??
      undefined
    );
  }

  private getInclusiveAllDayEndDate(exclusiveEndDate: string): string {
    const [year, month, day] = exclusiveEndDate.split('-').map(Number);
    const exclusiveEnd = Date.UTC(year, month - 1, day);
    const inclusiveEnd = new Date(exclusiveEnd - 24 * 60 * 60 * 1000);

    return inclusiveEnd.toISOString().slice(0, 10);
  }

  private async cacheEmptyEvents(): Promise<void> {
    await this.cache.set(this.cacheKey, [], this.negativeCacheTtlSeconds);
  }

  private logCalendarError(calendarId: string, error: unknown): void {
    const message = this.getErrorMessage(error);

    if (this.isUnauthorizedError(error)) {
      this.logger.error(
        'Google Calendar: refresh token invalido. Re-generar en OAuth2 Playground.',
      );
      return;
    }

    this.logger.error(`Google Calendar ${calendarId} request failed: ${message}`);
  }

  private isUnauthorizedError(error: unknown): boolean {
    return (
      error !== null && typeof error === 'object' && 'code' in error && Number(error.code) === 401
    );
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }

    return 'Unknown Google Calendar error';
  }

  private requireCalendar(): GoogleCalendarApi {
    if (!this.calendar) {
      throw new Error('GoogleCalendarService has not been initialized');
    }

    return this.calendar;
  }
}
