export interface AppConfiguration {
  port: number;
  serveStatic: boolean;
  sqlite: {
    path: string;
  };
  redis: {
    url: string;
  };
  telegram: {
    botToken?: string;
    chatId?: string;
  };
  jira: {
    baseUrl?: string;
    email?: string;
    apiToken?: string;
    projectKey?: string;
  };
  github: {
    token?: string;
    username?: string;
  };
  googleCalendar: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    calendarIds: string[];
  };
  slack: {
    userToken?: string;
    userId?: string;
  };
  scheduler: {
    cron: string;
    timezone: string;
  };
}

function configuration(): AppConfiguration {
  return {
    port: Number(process.env.PORT ?? 3000),
    serveStatic: (process.env.SERVE_STATIC ?? 'true') === 'true',
    sqlite: {
      path: process.env.SQLITE_PATH ?? '/app/data/portal.db',
    },
    redis: {
      url: process.env.REDIS_URL ?? 'redis://redis:6379',
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
    },
    jira: {
      baseUrl: process.env.JIRA_BASE_URL,
      email: process.env.JIRA_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN,
      projectKey: process.env.JIRA_PROJECT_KEY,
    },
    github: {
      token: process.env.GITHUB_TOKEN,
      username: process.env.GITHUB_USERNAME,
    },
    googleCalendar: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      calendarIds: (process.env.GOOGLE_CALENDAR_IDS ?? 'primary')
        .split(',')
        .map((calendarId) => calendarId.trim())
        .filter(Boolean),
    },
    slack: {
      userToken: process.env.SLACK_USER_TOKEN,
      userId: process.env.SLACK_USER_ID,
    },
    scheduler: {
      cron: process.env.MORNING_DIGEST_CRON ?? '0 8 * * *',
      timezone: process.env.TZ ?? 'America/Guatemala',
    },
  };
}

export default configuration;
