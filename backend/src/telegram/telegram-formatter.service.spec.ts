import { DailyDigest } from '../common/types/daily-digest.types';
import { TelegramFormatter } from './telegram-formatter.service';

const digest: DailyDigest = {
  date: '2026-06-29',
  generatedAt: '2026-06-29T14:00:00.000Z',
  todoList: [{ source: 'jira', priority: 'high', text: 'Fix TEMP-123!' }],
  tasks: [
    {
      id: '10001',
      key: 'TEMP-123',
      summary: 'Implement OAuth',
      status: 'In Progress',
      priority: 'High',
      url: 'https://jira.example.test/browse/TEMP-123',
    },
  ],
  prs: [
    {
      id: 1,
      title: 'API update',
      url: 'https://github.com/org/repo/pull/1',
      repo: 'org/repo',
      status: 'open',
      isDraft: false,
      hasNewComments: true,
      checkStatus: 'pending',
      hasConflicts: false,
      updatedAt: '2026-06-29T12:00:00.000Z',
    },
  ],
  events: [
    {
      id: 'event-1',
      title: 'Stand-up',
      startTime: '2026-06-29T15:00:00.000Z',
      endTime: '2026-06-29T15:15:00.000Z',
      calendarId: 'primary',
      calendarName: 'Work',
      isAllDay: false,
      meetUrl: 'https://meet.google.com/abc-defg-hij',
    },
  ],
  slackMentions: [
    {
      ts: '123.456',
      channelName: 'backend',
      senderName: 'Ana',
      text: 'Can you check this?',
      permalink: 'https://slack.example.test/archives/C123/p123',
    },
  ],
  reminders: [
    {
      id: 'reminder-1',
      text: 'Send proposal',
      date: '2026-06-29',
      priority: 'medium',
      completed: false,
      createdAt: '2026-06-29 08:00:00',
      updatedAt: '2026-06-29 08:00:00',
    },
  ],
};

describe('TelegramFormatter', () => {
  const formatter = new TelegramFormatter();

  it('formats a complete digest with all sections', () => {
    const message = formatter.format(digest);

    expect(message).toContain('Daily Digest');
    expect(message).toContain('Calendario');
    expect(message).toContain('Tareas Jira');
    expect(message).toContain('PRs que requieren atencion');
    expect(message).toContain('Slack');
    expect(message).toContain('Recordatorios de hoy');
    expect(message).toContain('TODO del dia');
  });

  it('shows empty section copy when digest sections are empty', () => {
    const message = formatter.format({
      ...digest,
      todoList: [],
      tasks: [],
      prs: [],
      events: [],
      slackMentions: [],
      reminders: [],
    });

    expect(message).toContain('_Sin elementos_');
  });

  it('escapes Telegram MarkdownV2 special characters', () => {
    expect(formatter.escape('_*[]()~`>#+-=|{}.!')).toBe(
      '\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!',
    );
  });

  it('limits long sections to five items', () => {
    const message = formatter.format({
      ...digest,
      tasks: Array.from({ length: 7 }, (_, index) => ({
        ...digest.tasks[0],
        id: String(index),
        key: `TEMP-${index}`,
      })),
    });

    expect(message).toContain('\\.\\.\\. y 2 mas');
  });

  it('formats PR conflict and failing check branches', () => {
    const message = formatter.format({
      ...digest,
      prs: [
        { ...digest.prs[0], hasConflicts: true },
        { ...digest.prs[0], id: 2, hasNewComments: false, checkStatus: 'failure' },
      ],
    });

    expect(message).toContain('Conflictos de merge');
    expect(message).toContain('Checks fallando');
  });

  it('omits successful PRs and formats all-day events without Meet links', () => {
    const message = formatter.format({
      ...digest,
      prs: [{ ...digest.prs[0], hasNewComments: false, checkStatus: 'success' }],
      events: [{ ...digest.events[0], isAllDay: true, meetUrl: undefined }],
    });

    expect(message).toContain('Sin elementos');
    expect(message).toContain('Todo el dia');
  });
});
