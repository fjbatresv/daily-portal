import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../common/cache';
import {
  CalendarEvent,
  DailyDigest,
  GitHubPR,
  JiraTask,
  Priority,
  Reminder,
  SlackMention,
  TodoItem,
} from '../common/types/daily-digest.types';
import { getEffectivePriority } from '../common/utils/reminder-priority.util';
import { GitHubService } from '../integrations/github';
import { GoogleCalendarService } from '../integrations/google-calendar';
import { JiraService } from '../integrations/jira';
import { SlackService } from '../integrations/slack';
import { RemindersService } from '../reminders';

const integrationCacheKeys = ['jira:tasks', 'github:prs', 'gcal:events', 'slack:mentions'] as const;
const priorityOrder: Priority[] = ['high', 'medium', 'low'];

/**
 * Builds the daily digest by collecting all sources without letting one failed source break the response.
 */
@Injectable()
export class DailyAggregatorService {
  private readonly logger = new Logger(DailyAggregatorService.name);

  constructor(
    private readonly jira: JiraService,
    private readonly github: GitHubService,
    private readonly googleCalendar: GoogleCalendarService,
    private readonly slack: SlackService,
    private readonly reminders: RemindersService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Returns a complete digest with partial fallbacks for failed integrations.
   */
  async buildDailyDigest(): Promise<DailyDigest> {
    const now = new Date();
    const [tasksResult, prsResult, eventsResult, mentionsResult] = await Promise.allSettled([
      this.jira.getTasks(),
      this.github.getPRs(),
      this.googleCalendar.getEvents(),
      this.slack.getMentions(),
    ]);

    const tasks = this.unwrapIntegrationResult('jira', tasksResult);
    const prs = this.unwrapIntegrationResult('github', prsResult);
    const events = this.unwrapIntegrationResult('google-calendar', eventsResult);
    const slackMentions = this.unwrapIntegrationResult('slack', mentionsResult);
    const reminders = this.getRemindersForDigest();

    return {
      date: now.toISOString().slice(0, 10),
      generatedAt: now.toISOString(),
      todoList: this.buildTodoList(tasks, prs, events, slackMentions, reminders),
      tasks,
      prs,
      events,
      slackMentions,
      reminders,
    };
  }

  /**
   * Clears integration cache entries so the next digest reads fresh upstream data.
   */
  async invalidateCache(): Promise<void> {
    await Promise.all(integrationCacheKeys.map((key) => this.cache.del(key)));
    this.logger.log('Integration cache invalidated');
  }

  /**
   * Produces the prioritized action list shown on the dashboard.
   */
  buildTodoList(
    tasks: JiraTask[],
    prs: GitHubPR[],
    events: CalendarEvent[],
    mentions: SlackMention[],
    reminders: Reminder[],
  ): TodoItem[] {
    const items: TodoItem[] = [
      ...this.buildGitHubTodoItems(prs),
      ...this.buildReminderTodoItems(reminders),
      ...this.buildJiraTodoItems(tasks),
      ...this.buildSlackTodoItems(mentions),
      ...this.buildCalendarTodoItems(events),
    ];

    return items.sort(
      (left, right) => priorityOrder.indexOf(left.priority) - priorityOrder.indexOf(right.priority),
    );
  }

  private buildGitHubTodoItems(prs: GitHubPR[]): TodoItem[] {
    const items: TodoItem[] = [];

    for (const pr of prs) {
      if (pr.hasConflicts) {
        items.push({
          source: 'github',
          priority: 'high',
          text: `Resolver conflictos: ${pr.title}`,
          url: pr.url,
        });
      }

      if (pr.checkStatus === 'failure') {
        items.push({
          source: 'github',
          priority: 'high',
          text: `Checks fallando: ${pr.title}`,
          url: pr.url,
        });
      }

      if (pr.hasNewComments && !pr.hasConflicts && pr.checkStatus !== 'failure') {
        items.push({
          source: 'github',
          priority: 'high',
          text: `Revisar comentarios: ${pr.title}`,
          url: pr.url,
        });
      }

      if (!pr.hasConflicts && pr.checkStatus !== 'failure' && !pr.hasNewComments) {
        items.push({
          source: 'github',
          priority: 'low',
          text: `Revisar PR abierto: ${pr.title}`,
          url: pr.url,
        });
      }
    }

    return items;
  }

  private buildReminderTodoItems(reminders: Reminder[]): TodoItem[] {
    return reminders
      .filter((reminder) => !reminder.completed)
      .map((reminder) => ({
        id: reminder.id,
        source: 'reminder',
        priority: getEffectivePriority(reminder.priority, reminder.date),
        text: reminder.text,
      }));
  }

  private buildJiraTodoItems(tasks: JiraTask[]): TodoItem[] {
    return tasks.map((task) => {
      const isInProgress = task.status.toLowerCase().includes('progress');
      return {
        source: 'jira',
        priority: isInProgress ? 'medium' : 'low',
        text: isInProgress ? `Continuar: ${task.summary}` : task.summary,
        url: task.url,
      };
    });
  }

  private buildSlackTodoItems(mentions: SlackMention[]): TodoItem[] {
    return mentions.map((mention) => ({
      source: 'slack',
      priority: 'medium',
      text: `#${mention.channelName}: ${this.truncate(mention.text, 50)}`,
      url: mention.permalink,
    }));
  }

  private buildCalendarTodoItems(events: CalendarEvent[]): TodoItem[] {
    return events.map((event) => ({
      source: 'calendar',
      priority: 'medium',
      text: event.title,
      dueTime: event.isAllDay ? undefined : new Date(event.startTime).toTimeString().slice(0, 5),
      url: event.meetUrl,
    }));
  }

  private getRemindersForDigest(): Reminder[] {
    try {
      return this.reminders.getTodayReminders();
    } catch (error) {
      this.logger.warn(`Reminders failed: ${this.getErrorMessage(error)}`);
      return [];
    }
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 3)}...`;
  }

  private unwrapIntegrationResult<T>(name: string, result: PromiseSettledResult<T[]>): T[] {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    this.logger.warn(`Integration ${name} failed: ${this.getErrorMessage(result.reason)}`);
    return [];
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
