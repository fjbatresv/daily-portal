import { Component, inject, input, signal } from '@angular/core';
import { Reminder } from '../../../core/models/daily-digest.model';
import { AppIconComponent } from '../../../shared/app-icon.component';
import { DashboardStore } from '../../dashboard/dashboard.store';
import { ReminderFormComponent } from './reminder-form.component';
import { ReminderItemComponent } from './reminder-item.component';

/**
 * Displays pending reminders and hosts the inline creation form.
 */
@Component({
  selector: 'app-reminders-section',
  imports: [AppIconComponent, ReminderFormComponent, ReminderItemComponent],
  template: `
    <section id="recordatorios" class="rounded-md border border-aurora-border bg-aurora-surface">
      <div class="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          class="flex items-center gap-2 text-sm font-semibold"
          [attr.aria-expanded]="open()"
          (click)="toggleOpen()"
        >
          <app-icon name="bell" className="h-4 w-4 text-aurora-primary" />
          Recordatorios
          <span class="rounded-full bg-aurora-elevated px-2 py-0.5 text-xs text-aurora-muted">{{
            reminders().length
          }}</span>
          <app-icon
            [name]="open() ? 'chevron-down' : 'chevron-right'"
            className="h-4 w-4 text-aurora-muted"
          />
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-md border border-aurora-border px-3 py-2 text-sm text-aurora-muted hover:border-aurora-primary hover:text-aurora-text"
          (click)="openReminderForm()"
        >
          <app-icon name="plus" className="h-4 w-4" />
          Nuevo
        </button>
      </div>

      @if (open()) {
        <div class="space-y-3 border-t border-aurora-border px-4 py-4">
          @if (store.reminderFormOpen()) {
            <app-reminder-form (created)="store.addReminder($event)" />
          }

          @if (pendingReminders().length === 0) {
            <p class="text-sm text-aurora-muted">No hay recordatorios pendientes.</p>
          } @else {
            @for (reminder of pendingReminders(); track reminder.id) {
              <app-reminder-item [reminder]="reminder" />
            }
          }
        </div>
      }
    </section>
  `,
})
export class RemindersSectionComponent {
  readonly reminders = input.required<Reminder[]>();
  readonly store = inject(DashboardStore);
  readonly open = signal(true);

  /**
   * Toggles section visibility.
   */
  toggleOpen(): void {
    this.open.update((value) => !value);
  }

  /**
   * Opens the collapsed section before showing the creation form.
   */
  openReminderForm(): void {
    this.open.set(true);
    this.store.reminderFormOpen.set(true);
  }

  /**
   * Returns incomplete reminders ordered by effective priority and age.
   */
  pendingReminders(): Reminder[] {
    const order = { high: 0, medium: 1, low: 2 };
    return this.reminders()
      .filter((reminder) => !reminder.completed)
      .sort(
        (left, right) =>
          order[left.escalatedPriority] - order[right.escalatedPriority] ||
          right.daysOverdue - left.daysOverdue,
      );
  }
}
