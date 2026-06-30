import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns defaults when optional environment variables are absent', () => {
    delete process.env.PORT;
    delete process.env.SERVE_STATIC;
    delete process.env.SQLITE_PATH;
    delete process.env.SQLITE_SCHEMA_PATH;
    delete process.env.REDIS_URL;
    delete process.env.GOOGLE_CALENDAR_IDS;
    delete process.env.MORNING_DIGEST_CRON;
    delete process.env.TZ;

    const config = configuration();

    expect(config).toMatchObject({
      port: 3000,
      serveStatic: true,
      sqlite: { path: '/app/data/portal.db' },
      redis: { url: 'redis://redis:6379' },
      googleCalendar: { calendarIds: ['primary'] },
      scheduler: {
        cron: '0 8 * * *',
        timezone: 'America/Guatemala',
      },
    });
    expect(config.sqlite.schemaPath).toContain('db/schema.sql');
  });

  it('maps configured environment variables into typed settings', () => {
    process.env.PORT = '4100';
    process.env.SERVE_STATIC = 'false';
    process.env.SQLITE_PATH = '/tmp/portal.db';
    process.env.SQLITE_SCHEMA_PATH = '/tmp/schema.sql';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-token';
    process.env.TELEGRAM_CHAT_ID = 'telegram-chat';
    process.env.JIRA_BASE_URL = 'https://jira.example.test';
    process.env.JIRA_EMAIL = 'user@example.test';
    process.env.JIRA_API_TOKEN = 'jira-token';
    process.env.JIRA_PROJECT_KEY = 'TEMP';
    process.env.GITHUB_TOKEN = 'github-token';
    process.env.GITHUB_USERNAME = 'octocat';
    process.env.GOOGLE_CLIENT_ID = 'google-client';
    process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'google-refresh';
    process.env.GOOGLE_CALENDAR_IDS = 'primary, work@example.test ,,';
    process.env.SLACK_USER_TOKEN = 'slack-token';
    process.env.SLACK_USER_ID = 'U123';
    process.env.MORNING_DIGEST_CRON = '5 8 * * *';
    process.env.TZ = 'America/Guatemala';

    expect(configuration()).toEqual({
      port: 4100,
      serveStatic: false,
      sqlite: { path: '/tmp/portal.db', schemaPath: '/tmp/schema.sql' },
      redis: { url: 'redis://localhost:6379' },
      telegram: {
        botToken: 'telegram-token',
        chatId: 'telegram-chat',
      },
      jira: {
        baseUrl: 'https://jira.example.test',
        email: 'user@example.test',
        apiToken: 'jira-token',
        projectKey: 'TEMP',
      },
      github: {
        token: 'github-token',
        username: 'octocat',
      },
      googleCalendar: {
        clientId: 'google-client',
        clientSecret: 'google-secret',
        refreshToken: 'google-refresh',
        calendarIds: ['primary', 'work@example.test'],
      },
      slack: {
        userToken: 'slack-token',
        userId: 'U123',
      },
      scheduler: {
        cron: '5 8 * * *',
        timezone: 'America/Guatemala',
      },
    });
  });
});
