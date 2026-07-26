import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, Observable, Subscription, tap } from 'rxjs';
import { DailyDigest, Priority, Reminder, TodoItem } from '../../core/models/daily-digest.model';
import { DashboardService } from '../../core/services/dashboard.service';
import { RemindersService } from '../../core/services/reminders.service';

/**
 * Top-level dashboard tabs exposed by the store.
 */
type DashboardTab = 'hoy' | 'fuentes';

/**
 * Storage key prefix for date-scoped non-reminder acknowledgements.
 */
const acknowledgedPrefix = 'portal:acknowledged:';

/**
 * Sorting rank that keeps high-priority TODO entries first.
 */
const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Formats the current portal-local day for fallback digests and acknowledgement keys.
 */
function formatPortalDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Guatemala',
    year: 'numeric',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

/**
 * Builds an empty digest fallback when the API cannot be reached.
 */
function createEmptyDigest(date = formatPortalDate()): DailyDigest {
  const generatedAt = new Date().toISOString();

  return {
    date,
    generatedAt,
    todoList: [],
    tasks: [],
    prs: [],
    events: [],
    slackMentions: [],
    reminders: [],
  };
}

/**
 * Coordinates dashboard data, tab state, refreshes, and local acknowledgement persistence.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly dashboard = inject(DashboardService);
  private readonly reminders = inject(RemindersService);
  private loadSubscription?: Subscription;

  /**
   * Latest digest loaded from the dashboard API.
   */
  readonly digest = signal<DailyDigest | null>(null);

  /**
   * Initial load indicator.
   */
  readonly loading = signal(false);

  /**
   * Manual refresh indicator.
   */
  readonly refreshing = signal(false);

  /**
   * User-facing load or refresh error message.
   */
  readonly error = signal<string | null>(null);

  /**
   * Active tab selected in the dashboard shell.
   */
  readonly activeTab = signal<DashboardTab>('hoy');

  /**
   * Locally acknowledged non-reminder TODO ids for the digest date.
   */
  readonly acknowledged = signal<Set<string>>(new Set());

  /**
   * Optimistic acknowledgement state for reminder TODOs completed through the API.
   */
  readonly reminderAcknowledged = signal<Set<string>>(new Set());

  /**
   * Whether the inline reminder creation form is open.
   */
  readonly reminderFormOpen = signal(false);

  /**
   * Count of visible TODO entries that still need action.
   */
  readonly pendingTodoCount = computed(
    () => this.todoItems().filter((item) => !item.acknowledged).length,
  );

  /**
   * Daily TODO entries enriched with ids, reminder records, and acknowledgement state.
   */
  readonly todoItems = computed(() => {
    const digest = this.digest();
    if (digest === null) {
      return [];
    }

    const nonReminderAcknowledged = this.acknowledged();
    const reminderAcknowledged = this.reminderAcknowledged();

    return digest.todoList
      .map((item, index) => {
        const reminder = item.source === 'reminder' ? this.findReminderForTodo(item) : undefined;
        const id = this.todoId(item, index, reminder?.id);
        const acknowledged =
          item.source === 'reminder'
            ? reminderAcknowledged.has(id)
            : nonReminderAcknowledged.has(id);

        return { id, item, reminder, acknowledged };
      })
      .sort((left, right) => {
        if (left.acknowledged !== right.acknowledged) {
          return left.acknowledged ? 1 : -1;
        }

        return priorityOrder[left.item.priority] - priorityOrder[right.item.priority];
      });
  });

  /**
   * Starts the dashboard auto-refresh stream and keeps local acknowledgement state date scoped.
   */
  load(): void {
    this.loadSubscription?.unsubscribe();
    this.loading.set(true);
    this.loadSubscription = this.dashboard
      .autoRefresh()
      .pipe(
        tap((digest) => this.applyDigest(digest)),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        error: () => {
          this.error.set('No se pudo cargar el dashboard.');
          this.ensureDigest();
          this.loading.set(false);
        },
      });
  }

  /**
   * Forces a backend refresh and replaces the current digest.
   */
  refresh(): void {
    this.refreshing.set(true);
    this.dashboard
      .refreshDailyDigest()
      .pipe(finalize(() => this.refreshing.set(false)))
      .subscribe({
        next: (digest) => this.applyDigest(digest),
        error: () => {
          this.error.set('No se pudo refrescar el dashboard.');
          this.ensureDigest();
        },
      });
  }

  /**
   * Opens the sources tab and expands the reminder creation form.
   */
  openReminderForm(): void {
    this.activeTab.set('fuentes');
    this.reminderFormOpen.set(true);
  }

  /**
   * Persists an acknowledgement when required and completes reminders through the API.
   */
  acknowledge(todoId: string): Observable<Reminder> | null {
    const entry = this.todoItems().find((candidate) => candidate.id === todoId);
    if (entry === undefined) {
      return null;
    }

    if (entry.item.source === 'reminder' && entry.reminder !== undefined) {
      this.reminderAcknowledged.update((current) => new Set(current).add(todoId));
      return this.reminders.complete(entry.reminder.id);
    }

    this.acknowledged.update((current) => new Set(current).add(todoId));
    this.persistAcknowledged();
    return null;
  }

  /**
   * Removes local acknowledgement state without mutating upstream systems.
   */
  undo(todoId: string): void {
    this.acknowledged.update((current) => {
      const next = new Set(current);
      next.delete(todoId);
      return next;
    });
    this.reminderAcknowledged.update((current) => {
      const next = new Set(current);
      next.delete(todoId);
      return next;
    });
    this.persistAcknowledged();
  }

  /**
   * Adds a created reminder to the current digest immediately.
   */
  addReminder(reminder: Reminder): void {
    const digest = this.digest();
    if (digest === null) {
      return;
    }

    this.digest.set({
      ...digest,
      reminders: [...digest.reminders, reminder],
      todoList: reminder.completed
        ? digest.todoList
        : [
            ...digest.todoList,
            {
              id: reminder.id,
              source: 'reminder',
              priority: reminder.escalatedPriority,
              text: reminder.text,
            },
          ],
    });
  }

  /**
   * Creates a stable local id for TODO acknowledgement persistence.
   */
  todoId(item: TodoItem, index: number, reminderId?: string): string {
    if (item.source === 'reminder' && (item.id !== undefined || reminderId !== undefined)) {
      return `reminder:${item.id ?? reminderId}`;
    }

    if (item.id !== undefined) {
      return `${item.source}:${item.id}`;
    }

    return `${item.source}:${item.url ?? item.dueTime ?? index}:${item.text}`;
  }

  private applyDigest(digest: DailyDigest): void {
    this.digest.set(digest);
    this.error.set(null);
    this.loadAcknowledged(digest.date);
    this.loading.set(false);
  }

  private ensureDigest(): void {
    if (this.digest() === null) {
      const digest = createEmptyDigest();
      this.digest.set(digest);
      this.loadAcknowledged(digest.date);
    }
  }

  private findReminderForTodo(item: TodoItem): Reminder | undefined {
    const digest = this.digest();
    return digest?.reminders.find((reminder) => !reminder.completed && reminder.id === item.id);
  }

  private loadAcknowledged(date: string): void {
    this.removeStaleAcknowledgements(date);

    try {
      const raw = localStorage.getItem(`${acknowledgedPrefix}${date}`);
      const ids = raw === null ? [] : (JSON.parse(raw) as string[]);
      this.acknowledged.set(new Set(ids));
    } catch {
      this.acknowledged.set(new Set());
    }
  }

  private persistAcknowledged(): void {
    const digest = this.digest();
    if (digest === null) {
      return;
    }

    try {
      localStorage.setItem(
        `${acknowledgedPrefix}${digest.date}`,
        JSON.stringify([...this.acknowledged()]),
      );
    } catch {
      // Local acknowledgement is a convenience; the dashboard remains usable without storage.
    }
  }

  private removeStaleAcknowledgements(currentDate: string): void {
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (
          key?.startsWith(acknowledgedPrefix) === true &&
          key !== `${acknowledgedPrefix}${currentDate}`
        ) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore storage cleanup failures in restricted browser contexts.
    }
  }
}
