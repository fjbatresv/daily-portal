import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { format } from 'date-fns';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from './app.module';
import { CacheService } from './common/cache';
import { CalendarEvent, GitHubPR, JiraTask, SlackMention } from './common/types/daily-digest.types';
import { GitHubService } from './integrations/github';
import { GoogleCalendarService } from './integrations/google-calendar';
import { JiraService } from './integrations/jira';
import { SlackService } from './integrations/slack';

interface HealthResponseBody {
  status: 'ok';
  timestamp: string;
  uptime: number;
}

interface ReminderResponseBody {
  completed: boolean;
  date: string;
  id: string;
  priority: string;
  text: string;
}

const jiraTask: JiraTask = {
  id: 'jira-1',
  key: 'TEMP-1',
  summary: 'Terminar backend',
  status: 'In Progress',
  priority: 'High',
  url: 'https://jira.example.com/browse/TEMP-1',
};

const githubPR: GitHubPR = {
  id: 321,
  title: 'Close backend',
  url: 'https://github.example.com/pr/321',
  repo: 'daily-portal',
  status: 'open',
  isDraft: false,
  hasNewComments: true,
  checkStatus: 'success',
  hasConflicts: false,
  updatedAt: '2026-06-29T14:00:00.000Z',
};

const calendarEvent: CalendarEvent = {
  id: 'event-1',
  title: 'Daily sync',
  startTime: '2026-06-29T15:00:00.000Z',
  endTime: '2026-06-29T15:30:00.000Z',
  calendarId: 'primary',
  calendarName: 'Primary',
  isAllDay: false,
};

const slackMention: SlackMention = {
  ts: '1719669600.000000',
  channelName: 'backend',
  senderName: 'Javier',
  text: 'Revisar smoke test',
  permalink: 'https://slack.example.com/message',
};

describe('Backend smoke e2e', () => {
  let app: INestApplication;
  let httpServer: Server;
  let tempDir: string;
  let cache: jest.Mocked<Pick<CacheService, 'del' | 'get' | 'set'>>;

  beforeAll(async () => {
    tempDir = join(tmpdir(), `daily-portal-e2e-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });
    process.env.SQLITE_PATH = join(tempDir, 'portal.db');
    process.env.SQLITE_SCHEMA_PATH = join(process.cwd(), '../db/schema.sql');
    process.env.SERVE_STATIC = 'false';
    process.env.NODE_ENV = 'test';

    cache = {
      del: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
      get: jest.fn<Promise<null>, [string]>().mockResolvedValue(null),
      set: jest.fn<Promise<void>, [string, unknown, number]>().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CacheService)
      .useValue(cache)
      .overrideProvider(JiraService)
      .useValue({ getTasks: jest.fn<Promise<JiraTask[]>, []>().mockResolvedValue([jiraTask]) })
      .overrideProvider(GitHubService)
      .useValue({ getPRs: jest.fn<Promise<GitHubPR[]>, []>().mockResolvedValue([githubPR]) })
      .overrideProvider(GoogleCalendarService)
      .useValue({
        getEvents: jest.fn<Promise<CalendarEvent[]>, []>().mockResolvedValue([calendarEvent]),
      })
      .overrideProvider(SlackService)
      .useValue({
        getMentions: jest.fn<Promise<SlackMention[]>, []>().mockResolvedValue([slackMention]),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
    rmSync(tempDir, { force: true, recursive: true });
    delete process.env.SQLITE_PATH;
    delete process.env.SQLITE_SCHEMA_PATH;
    delete process.env.SERVE_STATIC;
    delete process.env.NODE_ENV;
  });

  it('serves the health endpoint', async () => {
    const response = await request(httpServer).get('/api/health').expect(200);
    const body = response.body as unknown as HealthResponseBody;

    expect(body).toMatchObject({ status: 'ok' });
    expect(typeof body.timestamp).toBe('string');
    expect(typeof body.uptime).toBe('number');
  });

  it('supports reminder create, list, complete, and delete over HTTP', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const created = await request(httpServer)
      .post('/api/reminders')
      .send({ text: 'Probar backend completo', date: today, priority: 'medium' })
      .expect(201);
    const createdBody = created.body as unknown as ReminderResponseBody;

    expect(createdBody).toMatchObject({
      text: 'Probar backend completo',
      date: today,
      priority: 'medium',
      completed: false,
    });

    const list = await request(httpServer).get('/api/reminders').expect(200);
    const listBody = list.body as unknown as ReminderResponseBody[];
    expect(listBody).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: createdBody.id })]),
    );
    expect(listBody.some((item) => item.id === createdBody.id)).toBe(true);

    const completed = await request(httpServer)
      .patch(`/api/reminders/${createdBody.id}/complete`)
      .expect(200);
    const completedBody = completed.body as unknown as ReminderResponseBody;
    expect(completedBody.completed).toBe(true);

    await request(httpServer).delete(`/api/reminders/${createdBody.id}`).expect(204);
    await request(httpServer).get(`/api/reminders/${createdBody.id}`).expect(404);
  });

  it('rejects invalid reminder payloads through the real validation pipe', async () => {
    await request(httpServer)
      .post('/api/reminders')
      .send({ text: '', date: 'not-a-date', priority: 'medium' })
      .expect(400);
  });

  it('returns a dashboard digest with integration and persisted reminder data', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    await request(httpServer)
      .post('/api/reminders')
      .send({ text: 'Aparecer en dashboard', date: today, priority: 'high' })
      .expect(201);

    const response = await request(httpServer).get('/api/dashboard').expect(200);
    const body = response.body as unknown as {
      events: CalendarEvent[];
      prs: GitHubPR[];
      reminders: ReminderResponseBody[];
      slackMentions: SlackMention[];
      tasks: JiraTask[];
      todoList: Array<{ priority: string; source: string }>;
    };

    expect(body).toMatchObject({
      tasks: [jiraTask],
      prs: [githubPR],
      events: [calendarEvent],
      slackMentions: [slackMention],
    });
    expect(body.reminders).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: 'Aparecer en dashboard' })]),
    );
    expect(body.todoList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'github', priority: 'high' }),
        expect.objectContaining({ source: 'reminder', priority: 'high' }),
      ]),
    );
  });

  it('invalidates integration cache before returning a refreshed dashboard digest', async () => {
    const response = await request(httpServer).post('/api/dashboard/refresh').expect(200);
    const body = response.body as unknown as {
      events: CalendarEvent[];
      prs: GitHubPR[];
      slackMentions: SlackMention[];
      tasks: JiraTask[];
    };

    expect(body).toMatchObject({
      tasks: [jiraTask],
      prs: [githubPR],
      events: [calendarEvent],
      slackMentions: [slackMention],
    });
    expect(cache.del.mock.calls).toEqual([
      ['jira:tasks'],
      ['github:prs'],
      ['gcal:events'],
      ['slack:mentions'],
    ]);
  });
});
