import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calendar_v3, google } from 'googleapis';
import { CacheService } from '../../common/cache';
import { CalendarEvent } from '../../common/types/daily-digest.types';
import { AppConfiguration } from '../../config/configuration';
import { GoogleCalendarService } from './google-calendar.service';

interface GoogleCalendarApiMock {
  calendars: {
    get: jest.Mock;
  };
  events: {
    list: jest.Mock;
  };
}

jest.mock('googleapis', () => {
  const calendar = {
    calendars: {
      get: jest.fn(),
    },
    events: {
      list: jest.fn(),
    },
  };

  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn(),
        })),
      },
      calendar: jest.fn(() => calendar),
    },
  };
});

const calendarApi = google.calendar({
  version: 'v3',
}) as unknown as GoogleCalendarApiMock & calendar_v3.Calendar;

const mappedPrimaryEvent: CalendarEvent = {
  id: 'event-1',
  title: 'Daily standup',
  startTime: '2026-07-20T09:00:00-06:00',
  endTime: '2026-07-20T09:30:00-06:00',
  calendarId: 'primary',
  calendarName: 'Personal',
  isAllDay: false,
  meetUrl: 'https://meet.google.com/abc-defg-hij',
};

function expectedTodayBounds(): { timeMax: string; timeMin: string } {
  const now = new Date('2026-07-20T12:00:00.000Z');
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  return {
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
  };
}

describe('GoogleCalendarService', () => {
  let cache: jest.Mocked<CacheService>;
  let config: ConfigService<AppConfiguration, true>;
  let loggerErrorSpy: jest.SpiedFunction<Logger['error']>;
  let service: GoogleCalendarService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-20T12:00:00.000Z'));
    jest.clearAllMocks();
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;
    config = {
      get: jest.fn((key: string) => {
        if (key === 'googleCalendar.clientId') return 'client-id';
        if (key === 'googleCalendar.clientSecret') return 'client-secret';
        if (key === 'googleCalendar.refreshToken') return 'refresh-token';
        if (key === 'googleCalendar.calendarIds') return ['primary', 'team@example.com'];
        return undefined;
      }),
    } as unknown as ConfigService<AppConfiguration, true>;
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new GoogleCalendarService(config, cache);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.useRealTimers();
    loggerErrorSpy.mockRestore();
  });

  it('returns cached events without calling Google Calendar', async () => {
    cache.get.mockResolvedValue([mappedPrimaryEvent]);

    await expect(service.getEvents()).resolves.toEqual([mappedPrimaryEvent]);

    expect(calendarApi.events.list).not.toHaveBeenCalled();
    expect(cache.set.mock.calls).toHaveLength(0);
  });

  it('fetches two calendars in parallel, maps, sorts, and caches events', async () => {
    cache.get.mockResolvedValue(null);
    calendarApi.calendars.get
      .mockResolvedValueOnce({ data: { summary: 'Personal' } })
      .mockResolvedValueOnce({ data: { summary: 'Team' } });
    calendarApi.events.list
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'event-1',
              summary: 'Daily standup',
              start: { dateTime: '2026-07-20T09:00:00-06:00' },
              end: { dateTime: '2026-07-20T09:30:00-06:00' },
              hangoutLink: 'https://meet.google.com/abc-defg-hij',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'event-2',
              summary: 'Planning',
              start: { dateTime: '2026-07-20T08:00:00-06:00' },
              end: { dateTime: '2026-07-20T08:45:00-06:00' },
            },
          ],
        },
      });

    await expect(service.getEvents()).resolves.toEqual([
      {
        id: 'event-2',
        title: 'Planning',
        startTime: '2026-07-20T08:00:00-06:00',
        endTime: '2026-07-20T08:45:00-06:00',
        calendarId: 'team@example.com',
        calendarName: 'Team',
        isAllDay: false,
        meetUrl: undefined,
      },
      mappedPrimaryEvent,
    ]);

    expect(calendarApi.calendars.get.mock.calls).toEqual([
      [{ calendarId: 'primary' }],
      [{ calendarId: 'team@example.com' }],
    ]);
    expect(calendarApi.events.list).toHaveBeenCalledWith({
      calendarId: 'primary',
      ...expectedTodayBounds(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    });
    expect(cache.set.mock.calls).toEqual([
      [
        'gcal:events',
        [
          {
            id: 'event-2',
            title: 'Planning',
            startTime: '2026-07-20T08:00:00-06:00',
            endTime: '2026-07-20T08:45:00-06:00',
            calendarId: 'team@example.com',
            calendarName: 'Team',
            isAllDay: false,
            meetUrl: undefined,
          },
          mappedPrimaryEvent,
        ],
        600,
      ],
    ]);
  });

  it('keeps events from one calendar when another calendar fails', async () => {
    cache.get.mockResolvedValue(null);
    calendarApi.calendars.get
      .mockResolvedValueOnce({ data: { summary: 'Personal' } })
      .mockRejectedValueOnce(new Error('Calendar unavailable'));
    calendarApi.events.list.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'event-1',
            summary: 'Daily standup',
            start: { dateTime: '2026-07-20T09:00:00-06:00' },
            end: { dateTime: '2026-07-20T09:30:00-06:00' },
          },
        ],
      },
    });

    await expect(service.getEvents()).resolves.toEqual([
      {
        ...mappedPrimaryEvent,
        meetUrl: undefined,
      },
    ]);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Google Calendar team@example.com request failed: Calendar unavailable',
    );
  });

  it('maps all-day events and Meet URLs from conference data', async () => {
    cache.get.mockResolvedValue(null);
    calendarApi.calendars.get.mockResolvedValue({ data: { summary: 'Personal' } });
    calendarApi.events.list
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'all-day',
              summary: undefined,
              start: { date: '2026-07-20' },
              end: { date: '2026-07-21' },
              conferenceData: {
                entryPoints: [
                  { entryPointType: 'phone', uri: 'tel:+12345678' },
                  { entryPointType: 'video', uri: 'https://meet.google.com/xyz-abcd-efg' },
                ],
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: { items: [] } });

    await expect(service.getEvents()).resolves.toEqual([
      {
        id: 'all-day',
        title: '(sin titulo)',
        startTime: '2026-07-20T00:00:00',
        endTime: '2026-07-20T23:59:59',
        calendarId: 'primary',
        calendarName: 'Personal',
        isAllDay: true,
        meetUrl: 'https://meet.google.com/xyz-abcd-efg',
      },
    ]);
  });

  it('returns an empty list and logs a clear message when the refresh token is invalid', async () => {
    cache.get.mockResolvedValue(null);
    calendarApi.calendars.get.mockRejectedValue({ code: 401, message: 'Invalid Credentials' });

    await expect(service.getEvents()).resolves.toEqual([]);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Google Calendar: refresh token invalido. Re-generar en OAuth2 Playground.',
    );
    expect(cache.set.mock.calls).toEqual([['gcal:events', [], 600]]);
  });

  it('does not call Google Calendar when configuration is incomplete', async () => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'googleCalendar.calendarIds') return ['primary'];
        return undefined;
      }),
    } as unknown as ConfigService<AppConfiguration, true>;
    service = new GoogleCalendarService(config, cache);
    service.onModuleInit();
    cache.get.mockResolvedValue(null);

    await expect(service.getEvents()).resolves.toEqual([]);

    expect(calendarApi.events.list).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith('Google Calendar: configuration is incomplete');
    expect(cache.set.mock.calls).toEqual([['gcal:events', [], 30]]);
  });
});
