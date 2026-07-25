/**
 * Reminder priority used across dashboard summaries and reminder forms.
 */
export type Priority = 'low' | 'medium' | 'high';

/**
 * Pull request lifecycle state returned by the dashboard API.
 */
export type PRStatus = 'open' | 'merged' | 'closed' | 'draft';

/**
 * Aggregated CI/check status for a pull request.
 */
export type CheckStatus = 'success' | 'failure' | 'pending' | 'error';

/**
 * Source category used for generated daily TODO items.
 */
export type TodoSource = 'jira' | 'github' | 'calendar' | 'slack' | 'reminder';

/**
 * Jira issue displayed in the daily digest.
 */
export interface JiraTask {
  id: string;
  key: string;
  summary: string;
  status: string;
  priority: string;
  url: string;
}

/**
 * GitHub pull request displayed in the daily digest.
 */
export interface GitHubPR {
  id: number;
  title: string;
  url: string;
  repo: string;
  status: PRStatus;
  isDraft: boolean;
  hasNewComments: boolean;
  checkStatus: CheckStatus;
  hasConflicts: boolean;
  updatedAt: string;
}

/**
 * Calendar event displayed in the daily digest.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  calendarId: string;
  calendarName: string;
  isAllDay: boolean;
  meetUrl?: string;
}

/**
 * Slack mention displayed in the daily digest.
 */
export interface SlackMention {
  ts: string;
  channelName: string;
  senderName: string;
  text: string;
  permalink: string;
}

/**
 * Reminder returned by the reminders API with computed escalation metadata.
 */
export interface Reminder {
  id: string;
  text: string;
  date: string;
  priority: Priority;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  daysOverdue: number;
  escalatedPriority: Priority;
}

/**
 * Generated daily action item shown in the Hoy tab.
 */
export interface TodoItem {
  source: TodoSource;
  priority: Priority;
  text: string;
  url?: string;
  dueTime?: string;
}

/**
 * Complete response for the dashboard daily digest endpoint.
 */
export interface DailyDigest {
  date: string;
  todoList: TodoItem[];
  tasks: JiraTask[];
  prs: GitHubPR[];
  events: CalendarEvent[];
  slackMentions: SlackMention[];
  reminders: Reminder[];
  generatedAt: string;
}

/**
 * Payload used to create a reminder.
 */
export interface CreateReminderDto {
  text: string;
  date: string;
  priority?: Priority;
}

/**
 * Partial payload used to update a reminder.
 */
export interface UpdateReminderDto {
  text?: string;
  date?: string;
  priority?: Priority;
  completed?: boolean;
}
