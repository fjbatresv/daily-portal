export type Priority = 'high' | 'medium' | 'low';
export type PRStatus = 'open' | 'merged' | 'closed' | 'draft';
export type CheckStatus = 'success' | 'failure' | 'pending' | 'error';

export interface JiraTask {
  id: string;
  key: string;
  summary: string;
  status: string;
  priority: string;
  url: string;
}

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

export interface SlackMention {
  ts: string;
  channelName: string;
  senderName: string;
  text: string;
  permalink: string;
}

export interface Reminder {
  id: string;
  text: string;
  date: string;
  priority: Priority;
  completed: boolean;
  createdAt: string;
}

export interface TodoItem {
  source: 'jira' | 'github' | 'calendar' | 'slack' | 'reminder';
  priority: Priority;
  text: string;
  url?: string;
  dueTime?: string;
}

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

export interface IntegrationResult<T> {
  data: T[];
  error?: string;
}
