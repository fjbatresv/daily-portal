import { Component, input, output } from '@angular/core';
import { Reminder, TodoItem, TodoSource } from '../../core/models/daily-digest.model';

interface TodoEntry {
  id: string;
  item: TodoItem;
  reminder?: Reminder;
  acknowledged: boolean;
}

const sourceLabels: Record<TodoSource, string> = {
  jira: 'Jira',
  github: 'GitHub',
  calendar: 'Calendar',
  slack: 'Slack',
  reminder: 'Reminder',
};

/**
 * Displays one actionable TODO row with source, priority, metadata, and acknowledgement control.
 */
@Component({
  selector: 'app-todo-item',
  templateUrl: './todo-item.component.html',
})
export class TodoItemComponent {
  readonly entry = input.required<TodoEntry>();
  readonly checkedChange = output<void>();

  /**
   * Returns the user-facing source label.
   */
  sourceLabel(source: TodoSource): string {
    return sourceLabels[source];
  }

  /**
   * Returns the integration token color for inline badge styling.
   */
  sourceColor(source: TodoSource): string {
    return source === 'reminder' ? 'var(--color-primary)' : `var(--color-${source})`;
  }

  /**
   * Formats the visible priority label.
   */
  priorityLabel(priority: TodoItem['priority']): string {
    return priority === 'high' ? 'alta' : priority === 'medium' ? 'media' : 'baja';
  }
}
