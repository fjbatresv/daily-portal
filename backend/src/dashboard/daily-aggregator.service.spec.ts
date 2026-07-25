import { Logger } from '@nestjs/common';
import { CacheService } from '../common/cache';
import {
  CalendarEvent,
  GitHubPR,
  JiraTask,
  Reminder,
  SlackMention,
} from '../common/types/daily-digest.types';
import { GitHubService } from '../integrations/github';
import { GoogleCalendarService } from '../integrations/google-calendar';
import { JiraService } from '../integrations/jira';
import { SlackService } from '../integrations/slack';
import { RemindersService } from '../reminders';
import { DailyAggregatorService } from './daily-aggregator.service';

const jiraTask: JiraTask = {
  id: 'jira-1',
  key: 'TEMP-1',
  summary: 'Implementar API',
  status: 'In Progress',
  priority: 'High',
  url: 'https://jira.example.com/browse/TEMP-1',
};

const githubPR: GitHubPR = {
  id: 123,
  title: 'Backend aggregation',
  url: 'https://github.example.com/pr/123',
  repo: 'daily-portal',
  status: 'open',
  isDraft: false,
  hasNewComments: false,
  checkStatus: 'success',
  hasConflicts: false,
  updatedAt: '2026-06-29T13:00:00.000Z',
};

const calendarEvent: CalendarEvent = {
  id: 'event-1',
  title: 'Standup',
  startTime: '2026-06-29T14:00:00.000Z',
  endTime: '2026-06-29T14:30:00.000Z',
  calendarId: 'primary',
  calendarName: 'Primary',
  isAllDay: false,
  meetUrl: 'https://meet.example.com/abc',
};

const slackMention: SlackMention = {
  ts: '1719669600.000000',
  channelName: 'daily',
  senderName: 'Javier',
  text: 'Puedes revisar esto?',
  permalink: 'https://slack.example.com/message',
};

const reminder: Reminder = {
  id: 'reminder-1',
  text: 'Enviar seguimiento',
  date: '2000-01-01',
  priority: 'low',
  completed: false,
  createdAt: '2026-06-29T13:00:00.000Z',
  updatedAt: '2026-06-29T13:00:00.000Z',
};

describe('DailyAggregatorService', () => {
  let jira: jest.Mocked<JiraService>;
  let github: jest.Mocked<GitHubService>;
  let googleCalendar: jest.Mocked<GoogleCalendarService>;
  let slack: jest.Mocked<SlackService>;
  let reminders: jest.Mocked<RemindersService>;
  let cache: jest.Mocked<CacheService>;
  let service: DailyAggregatorService;
  let loggerWarnSpy: jest.SpiedFunction<Logger['warn']>;

  beforeEach(() => {
    jira = {
      getTasks: jest.fn<Promise<JiraTask[]>, []>().mockResolvedValue([jiraTask]),
    } as unknown as jest.Mocked<JiraService>;
    github = {
      getPRs: jest.fn<Promise<GitHubPR[]>, []>().mockResolvedValue([githubPR]),
    } as unknown as jest.Mocked<GitHubService>;
    googleCalendar = {
      getEvents: jest.fn<Promise<CalendarEvent[]>, []>().mockResolvedValue([calendarEvent]),
    } as unknown as jest.Mocked<GoogleCalendarService>;
    slack = {
      getMentions: jest.fn<Promise<SlackMention[]>, []>().mockResolvedValue([slackMention]),
    } as unknown as jest.Mocked<SlackService>;
    reminders = {
      getTodayReminders: jest.fn<Reminder[], []>().mockReturnValue([reminder]),
    } as unknown as jest.Mocked<RemindersService>;
    cache = {
      del: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheService>;
    service = new DailyAggregatorService(jira, github, googleCalendar, slack, reminders, cache);
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  it('builds a complete digest when every source succeeds', async () => {
    const digest = await service.buildDailyDigest();

    expect(digest.tasks).toEqual([jiraTask]);
    expect(digest.prs).toEqual([githubPR]);
    expect(digest.events).toEqual([calendarEvent]);
    expect(digest.slackMentions).toEqual([slackMention]);
    expect(digest.reminders).toEqual([reminder]);
    expect(digest.todoList.map((item) => item.source)).toEqual([
      'reminder',
      'jira',
      'slack',
      'calendar',
      'github',
    ]);
  });

  it('keeps the digest usable when one integration fails', async () => {
    github.getPRs.mockRejectedValue(new Error('GitHub failed'));

    const digest = await service.buildDailyDigest();

    expect(digest.prs).toEqual([]);
    expect(digest.tasks).toEqual([jiraTask]);
    expect(digest.events).toEqual([calendarEvent]);
    expect(digest.slackMentions).toEqual([slackMention]);
    expect(loggerWarnSpy).toHaveBeenCalledWith('Integration github failed: GitHub failed');
  });

  it('returns empty integration sections when every integration fails', async () => {
    jira.getTasks.mockRejectedValue(new Error('Jira failed'));
    github.getPRs.mockRejectedValue(new Error('GitHub failed'));
    googleCalendar.getEvents.mockRejectedValue(new Error('Calendar failed'));
    slack.getMentions.mockRejectedValue(new Error('Slack failed'));

    const digest = await service.buildDailyDigest();

    expect(digest.tasks).toEqual([]);
    expect(digest.prs).toEqual([]);
    expect(digest.events).toEqual([]);
    expect(digest.slackMentions).toEqual([]);
    expect(digest.reminders).toEqual([reminder]);
  });

  it('puts a PR with conflicts at high priority at the top of the TODO list', () => {
    const todoList = service.buildTodoList(
      [jiraTask],
      [{ ...githubPR, hasConflicts: true }],
      [],
      [],
      [],
    );

    expect(todoList[0]).toMatchObject({
      source: 'github',
      priority: 'high',
      text: 'Resolver conflictos: Backend aggregation',
    });
  });

  it('creates high-priority TODOs for both conflicts and failing checks on the same PR', () => {
    const todoList = service.buildTodoList(
      [],
      [{ ...githubPR, hasConflicts: true, checkStatus: 'failure' }],
      [],
      [],
      [],
    );

    expect(todoList).toEqual([
      {
        source: 'github',
        priority: 'high',
        text: 'Resolver conflictos: Backend aggregation',
        url: 'https://github.example.com/pr/123',
      },
      {
        source: 'github',
        priority: 'high',
        text: 'Checks fallando: Backend aggregation',
        url: 'https://github.example.com/pr/123',
      },
    ]);
  });

  it('uses effective reminder priority when ordering TODO items', () => {
    const todoList = service.buildTodoList([jiraTask], [], [], [], [reminder]);

    expect(todoList[0]).toMatchObject({
      id: 'reminder-1',
      source: 'reminder',
      priority: 'high',
      text: 'Enviar seguimiento',
    });
  });

  it('excludes completed reminders from the TODO list', () => {
    const todoList = service.buildTodoList([], [], [], [], [{ ...reminder, completed: true }]);

    expect(todoList).toEqual([]);
  });

  it('truncates long Slack mentions for TODO text', () => {
    const todoList = service.buildTodoList(
      [],
      [],
      [],
      [
        {
          ...slackMention,
          text: 'Este mensaje de Slack es suficientemente largo para necesitar truncado',
        },
      ],
      [],
    );

    expect(todoList).toEqual([
      {
        source: 'slack',
        priority: 'medium',
        text: '#daily: Este mensaje de Slack es suficientemente largo ...',
        url: 'https://slack.example.com/message',
      },
    ]);
  });

  it('does not assign dueTime to all-day calendar events', () => {
    const todoList = service.buildTodoList(
      [],
      [],
      [{ ...calendarEvent, isAllDay: true, meetUrl: undefined }],
      [],
      [],
    );

    expect(todoList).toEqual([
      {
        source: 'calendar',
        priority: 'medium',
        text: 'Standup',
        dueTime: undefined,
        url: undefined,
      },
    ]);
  });

  it('keeps the digest usable when local reminders fail', async () => {
    reminders.getTodayReminders.mockImplementation(() => {
      throw new Error('SQLite failed');
    });

    const digest = await service.buildDailyDigest();

    expect(digest.reminders).toEqual([]);
    expect(digest.todoList.some((item) => item.source === 'reminder')).toBe(false);
    expect(loggerWarnSpy).toHaveBeenCalledWith('Reminders failed: SQLite failed');
  });

  it('invalidates all integration cache keys', async () => {
    await service.invalidateCache();

    expect(cache.del.mock.calls).toEqual([
      ['jira:tasks'],
      ['github:prs'],
      ['gcal:events'],
      ['slack:mentions'],
    ]);
  });
});
