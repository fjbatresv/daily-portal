import { Component, input, output } from '@angular/core';
import { TodoItem, TodoSource } from '../../core/models/daily-digest.model';
import type { DashboardStore } from '../dashboard/dashboard.store';

type TodoEntry = ReturnType<DashboardStore['todoItems']>[number];

const sourceLabels: Record<TodoSource, string> = {
  jira: 'Jira',
  github: 'GitHub',
  calendar: 'Calendario',
  slack: 'Slack',
  reminder: 'Recordatorio',
};

const sourceBadgeClasses: Record<TodoSource, string> = {
  jira: 'rounded-full border border-integration-jira px-2 py-0.5 text-xs text-integration-jira',
  github:
    'rounded-full border border-integration-github px-2 py-0.5 text-xs text-integration-github',
  calendar:
    'rounded-full border border-integration-calendar px-2 py-0.5 text-xs text-integration-calendar',
  slack: 'rounded-full border border-integration-slack px-2 py-0.5 text-xs text-integration-slack',
  reminder: 'rounded-full border border-aurora-primary px-2 py-0.5 text-xs text-aurora-primary',
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
   * Returns Tailwind token classes for source badge styling.
   */
  sourceBadgeClass(source: TodoSource): string {
    return sourceBadgeClasses[source];
  }

  /**
   * Formats the visible priority label.
   */
  priorityLabel(priority: TodoItem['priority']): string {
    return priority === 'high' ? 'alta' : priority === 'medium' ? 'media' : 'baja';
  }
}
