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

type IsoDate = string;
type IsoDateTime = string;
type WebUrl = string;

/**
 * Jira issue displayed in the daily digest.
 */
export interface JiraTask {
  url: WebUrl;
  priority: string;
  status: string;
  summary: string;
  key: string;
  id: string;
}

/**
 * GitHub pull request displayed in the daily digest.
 */
export interface GitHubPR {
  updatedAt: IsoDateTime;
  hasConflicts: boolean;
  checkStatus: CheckStatus;
  hasNewComments: boolean;
  isDraft: boolean;
  status: PRStatus;
  repo: string;
  url: WebUrl;
  title: string;
  id: number;
}

/**
 * Calendar event displayed in the daily digest.
 */
export interface CalendarEvent {
  meetUrl?: WebUrl;
  isAllDay: boolean;
  calendarName: string;
  calendarId: string;
  endTime: IsoDateTime;
  startTime: IsoDateTime;
  title: string;
  id: string;
}

/**
 * Slack mention displayed in the daily digest.
 */
export interface SlackMention {
  permalink: WebUrl;
  text: string;
  senderName: string;
  channelName: string;
  ts: string;
}

/**
 * Reminder returned by the reminders API with computed escalation metadata.
 */
export interface Reminder {
  escalatedPriority: Priority;
  daysOverdue: number;
  updatedAt: IsoDateTime;
  createdAt: IsoDateTime;
  completed: boolean;
  priority: Priority;
  date: IsoDate;
  text: string;
  id: string;
}

/**
 * Generated daily action item shown in the Hoy tab.
 */
export interface TodoItem {
  id?: string;
  dueTime?: string;
  url?: WebUrl;
  text: string;
  priority: Priority;
  source: TodoSource;
}

/**
 * Complete response for the dashboard daily digest endpoint.
 */
export interface DailyDigest {
  generatedAt: IsoDateTime;
  reminders: Reminder[];
  slackMentions: SlackMention[];
  events: CalendarEvent[];
  prs: GitHubPR[];
  tasks: JiraTask[];
  todoList: TodoItem[];
  date: IsoDate;
}

/**
 * Payload used to create a reminder.
 */
export interface CreateReminderDto {
  priority?: Priority;
  date: IsoDate;
  text: string;
}

/**
 * Partial payload used to update a reminder.
 */
export interface UpdateReminderDto {
  completed?: boolean;
  priority?: Priority;
  date?: IsoDate;
  text?: string;
}
