import { Component, input } from '@angular/core';
import { Priority, Reminder } from '../../../core/models/daily-digest.model';
import { AppIconComponent } from '../../../shared/app-icon.component';

/**
 * Renders one reminder with effective priority and escalation context.
 */
@Component({
  selector: 'app-reminder-item',
  imports: [AppIconComponent],
  template: `
    @let item = reminder();
    <article class="rounded-md border border-aurora-border bg-aurora-bg p-4">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <span
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
          [class]="priorityClass(item.escalatedPriority)"
        >
          @if (item.escalatedPriority !== item.priority) {
            <app-icon name="trending-up" className="h-3.5 w-3.5" />
          }
          {{ priorityLabel(item.escalatedPriority) }}
        </span>
        <span class="font-mono text-xs text-aurora-muted">{{ item.date }}</span>
      </div>
      <p class="text-sm font-medium text-aurora-text">{{ item.text }}</p>
      @if (item.escalatedPriority !== item.priority) {
        <p class="mt-2 text-xs text-aurora-muted">
          hace {{ item.daysOverdue }} dias · prioridad original: {{ priorityLabel(item.priority) }}
        </p>
      }
    </article>
  `,
})
export class ReminderItemComponent {
  readonly reminder = input.required<Reminder>();

  /**
   * Converts stored/effective priority values to Spanish labels.
   */
  priorityLabel(priority: Priority): string {
    return priority === 'high' ? 'alta' : priority === 'medium' ? 'media' : 'baja';
  }

  /**
   * Returns semantic classes for priority badges.
   */
  priorityClass(priority: Priority): string {
    if (priority === 'high') {
      return 'bg-[var(--color-error-muted)] text-[var(--color-error-text)]';
    }

    if (priority === 'medium') {
      return 'bg-[var(--color-warning-muted)] text-[var(--color-warning-text)]';
    }

    return 'bg-[var(--color-success-muted)] text-[var(--color-success-text)]';
  }
}
