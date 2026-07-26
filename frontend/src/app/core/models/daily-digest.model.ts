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
 * ISO calendar date without time, formatted as YYYY-MM-DD.
 */
type IsoDate = string;

/**
 * ISO timestamp used for API payloads and digest generation metadata.
 */
type IsoDateTime = string;

/**
 * Absolute URL rendered as an external navigation target.
 */
type WebUrl = string;

/**
 * Jira issue displayed in the daily digest.
 */
export interface JiraTask {
  /** Browser URL for the Jira issue. */
  url: WebUrl;
  /** Jira priority label as returned by the API. */
  priority: string;
  /** Current workflow status for the issue. */
  status: string;
  /** Short issue title shown in source and TODO views. */
  summary: string;
  /** Human-readable Jira key, such as TEMP-123. */
  key: string;
  /** Stable Jira issue id. */
  id: string;
}

/**
 * GitHub pull request displayed in the daily digest.
 */
export interface GitHubPR {
  /** Last update timestamp used for recency sorting and metadata. */
  updatedAt: IsoDateTime;
  /** Whether GitHub reports merge conflicts. */
  hasConflicts: boolean;
  /** Aggregated check conclusion for the pull request. */
  checkStatus: CheckStatus;
  /** Whether review comments need attention. */
  hasNewComments: boolean;
  /** Whether the pull request is still marked as draft. */
  isDraft: boolean;
  /** Pull request lifecycle state. */
  status: PRStatus;
  /** Repository name displayed with the PR. */
  repo: string;
  /** Browser URL for the pull request. */
  url: WebUrl;
  /** Pull request title. */
  title: string;
  /** Numeric GitHub pull request id. */
  id: number;
}

/**
 * Calendar event displayed in the daily digest.
 */
export interface CalendarEvent {
  /** Optional meeting URL rendered as a quick action. */
  meetUrl?: WebUrl;
  /** Whether the event spans the full day instead of a clock range. */
  isAllDay: boolean;
  /** Display name for the source calendar. */
  calendarName: string;
  /** Calendar id returned by Google Calendar. */
  calendarId: string;
  /** ISO end timestamp. */
  endTime: IsoDateTime;
  /** ISO start timestamp used for timeline ordering. */
  startTime: IsoDateTime;
  /** Event title shown in the calendar source section. */
  title: string;
  /** Stable calendar event id. */
  id: string;
}

/**
 * Slack mention displayed in the daily digest.
 */
export interface SlackMention {
  /** Direct Slack permalink for the mention. */
  permalink: WebUrl;
  /** Mention excerpt shown in the source section. */
  text: string;
  /** Display name for the message author. */
  senderName: string;
  /** Slack channel name without the leading hash. */
  channelName: string;
  /** Slack timestamp used as a stable mention id. */
  ts: string;
}

/**
 * Reminder returned by the reminders API with computed escalation metadata.
 */
export interface Reminder {
  /** Priority after age-based escalation is applied by the backend. */
  escalatedPriority: Priority;
  /** Number of days since the reminder date when overdue. */
  daysOverdue: number;
  /** Last persistence update timestamp. */
  updatedAt: IsoDateTime;
  /** Creation timestamp from SQLite. */
  createdAt: IsoDateTime;
  /** Whether the reminder has been completed. */
  completed: boolean;
  /** User-selected base priority before escalation. */
  priority: Priority;
  /** Date the reminder starts appearing as due. */
  date: IsoDate;
  /** Reminder text entered by the user. */
  text: string;
  /** Stable reminder id. */
  id: string;
}

/**
 * Generated daily action item shown in the Hoy tab.
 */
export interface TodoItem {
  /** Optional backend id used for reminder acknowledgement. */
  id?: string;
  /** Optional due time rendered for calendar-derived items. */
  dueTime?: string;
  /** Optional external URL for source items. */
  url?: WebUrl;
  /** Human-readable action text. */
  text: string;
  /** Effective priority used for ordering. */
  priority: Priority;
  /** Integration or reminder source for the TODO item. */
  source: TodoSource;
}

/**
 * Complete response for the dashboard daily digest endpoint.
 */
export interface DailyDigest {
  /** Generation timestamp for freshness display and debugging. */
  generatedAt: IsoDateTime;
  /** Reminder records included in the digest. */
  reminders: Reminder[];
  /** Slack mentions included in the digest. */
  slackMentions: SlackMention[];
  /** Calendar events included in the digest. */
  events: CalendarEvent[];
  /** Pull requests included in the digest. */
  prs: GitHubPR[];
  /** Jira issues included in the digest. */
  tasks: JiraTask[];
  /** Prioritized action list synthesized from all sources. */
  todoList: TodoItem[];
  /** Digest date in the portal timezone. */
  date: IsoDate;
}

/**
 * Payload used to create a reminder.
 */
export interface CreateReminderDto {
  /** Initial priority selected in the reminder form. */
  priority?: Priority;
  /** Due date for the new reminder. */
  date: IsoDate;
  /** Required reminder body, capped by the frontend form. */
  text: string;
}

/**
 * Partial payload used to update a reminder.
 */
export interface UpdateReminderDto {
  /** Completion state when toggling a reminder. */
  completed?: boolean;
  /** Replacement priority when editing a reminder. */
  priority?: Priority;
  /** Replacement due date when editing a reminder. */
  date?: IsoDate;
  /** Replacement reminder body when editing a reminder. */
  text?: string;
}
