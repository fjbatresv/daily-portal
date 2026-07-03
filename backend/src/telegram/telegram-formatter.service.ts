import { Injectable } from '@nestjs/common';
import {
  CalendarEvent,
  DailyDigest,
  GitHubPR,
  JiraTask,
  Reminder,
  SlackMention,
  TodoItem,
} from '../common/types/daily-digest.types';

const maxSectionItems = 5;

/**
 * Formats daily digest data as Telegram MarkdownV2.
 */
@Injectable()
export class TelegramFormatter {
  /**
   * Builds the full Telegram message for a daily digest.
   */
  format(digest: DailyDigest): string {
    const parts = [
      `*Daily Digest - ${this.escape(digest.date)}*`,
      this.formatEvents(digest.events),
      this.formatTasks(digest.tasks),
      this.formatPRs(digest.prs),
      this.formatMentions(digest.slackMentions),
      this.formatReminders(digest.reminders),
      this.formatTodoList(digest.todoList),
      `_Generado a las ${this.escape(this.formatTime(digest.generatedAt))}_`,
    ];

    return parts.join('\n\n');
  }

  /**
   * Escapes user-controlled text for Telegram MarkdownV2.
   */
  escape(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  private formatTasks(tasks: JiraTask[]): string {
    return this.formatSection(
      `Tareas Jira (${tasks.length} activas)`,
      tasks.slice(0, maxSectionItems).map((task) => `- [${task.key}] ${task.summary}`),
      tasks.length,
    );
  }

  private formatPRs(prs: GitHubPR[]): string {
    const attentionPRs = prs.filter(
      (pr) => pr.hasConflicts || pr.hasNewComments || pr.checkStatus !== 'success',
    );

    return this.formatSection(
      `PRs que requieren atencion (${attentionPRs.length})`,
      attentionPRs.slice(0, maxSectionItems).map((pr) => {
        const status = this.prAttentionText(pr);
        return `${status.emoji} [${pr.repo}] ${status.text}: ${pr.title}`;
      }),
      attentionPRs.length,
    );
  }

  private formatEvents(events: CalendarEvent[]): string {
    return this.formatSection(
      `Calendario (${events.length} eventos)`,
      events.slice(0, maxSectionItems).map((event) => {
        const time = event.isAllDay ? 'Todo el dia' : this.formatTime(event.startTime);
        const meet = event.meetUrl ? ` [Meet](${this.escapeUrl(event.meetUrl)})` : '';
        return `${time} ${event.title}${meet}`;
      }),
      events.length,
    );
  }

  private formatMentions(mentions: SlackMention[]): string {
    return this.formatSection(
      `Slack (${mentions.length} menciones)`,
      mentions
        .slice(0, maxSectionItems)
        .map((mention) => `#${mention.channelName}: "${mention.text}"`),
      mentions.length,
    );
  }

  private formatReminders(reminders: Reminder[]): string {
    return this.formatSection(
      `Recordatorios de hoy (${reminders.length})`,
      reminders.slice(0, maxSectionItems).map((reminder) => reminder.text),
      reminders.length,
    );
  }

  private formatTodoList(items: TodoItem[]): string {
    if (items.length === 0) {
      return `*${this.escape('TODO del dia')}*\n_${this.escape('Sin elementos')}_`;
    }

    const visibleItems = items.slice(0, maxSectionItems).map((item, index) => {
      const dueTime = item.dueTime ? ` ${item.dueTime}` : '';
      return `${index + 1}\\. ${this.escape(item.text + dueTime)}`;
    });
    const hiddenCount = items.length - visibleItems.length;
    const suffix = hiddenCount > 0 ? [`${this.escape(`... y ${hiddenCount} mas`)}`] : [];

    return [`*${this.escape('TODO del dia')}*`, ...visibleItems, ...suffix].join('\n');
  }

  private formatSection(title: string, rawItems: string[], totalCount: number): string {
    const heading = `*${this.escape(title)}*`;

    if (rawItems.length === 0) {
      return `${heading}\n_${this.escape('Sin elementos')}_`;
    }

    const items = rawItems.map((item) => `\\- ${this.escape(item)}`);
    const hiddenCount = totalCount - rawItems.length;
    if (hiddenCount > 0) {
      items.push(this.escape(`... y ${hiddenCount} mas`));
    }

    return [heading, ...items].join('\n');
  }

  private prAttentionText(pr: GitHubPR): { emoji: string; text: string } {
    if (pr.hasConflicts) {
      return { emoji: '🔴', text: 'Conflictos de merge' };
    }

    if (pr.checkStatus === 'failure' || pr.checkStatus === 'error') {
      return { emoji: '🔴', text: 'Checks fallando' };
    }

    if (pr.hasNewComments) {
      return { emoji: '⚠️', text: 'Comentarios nuevos' };
    }

    return { emoji: '⚠️', text: 'Checks pendientes' };
  }

  private formatTime(value: string): string {
    return new Intl.DateTimeFormat('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Guatemala',
    }).format(new Date(value));
  }

  private escapeUrl(url: string): string {
    return url.replace(/[)\\]/g, '\\$&');
  }
}
