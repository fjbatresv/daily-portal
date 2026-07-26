import { Component, input, signal } from '@angular/core';
import { JiraTask } from '../../core/models/daily-digest.model';
import { AppIconComponent } from '../../shared/app-icon.component';

/**
 * Shows Jira issues with key, status, priority, and direct links.
 */
@Component({
  selector: 'app-jira-section',
  imports: [AppIconComponent],
  template: `
    <section class="rounded-md border border-aurora-border bg-aurora-surface">
      <button
        type="button"
        class="flex w-full items-center justify-between px-4 py-3"
        [attr.aria-expanded]="open()"
        (click)="toggleOpen()"
      >
        <span class="flex items-center gap-2 text-sm font-semibold">
          <app-icon name="ticket" className="h-4 w-4 text-integration-jira" />
          Jira
          <span class="rounded-full bg-aurora-elevated px-2 py-0.5 text-xs text-aurora-muted">{{
            tasks().length
          }}</span>
        </span>
        <app-icon
          [name]="open() ? 'chevron-down' : 'chevron-right'"
          className="h-4 w-4 text-aurora-muted"
        />
      </button>

      @if (open()) {
        <div class="space-y-3 border-t border-aurora-border px-4 py-4">
          @if (tasks().length === 0) {
            <p class="text-sm text-aurora-muted">No hay tareas de Jira activas.</p>
          } @else {
            @for (task of tasks(); track task.id) {
              <a
                class="block rounded-md border border-aurora-border bg-aurora-bg p-4 transition hover:border-integration-jira"
                [href]="task.url"
                target="_blank"
                rel="noreferrer"
              >
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="font-mono text-sm text-integration-jira">{{ task.key }}</span>
                  <span
                    class="rounded-full bg-aurora-elevated px-2 py-0.5 text-xs text-aurora-muted"
                    >{{ task.status }}</span
                  >
                  <span
                    class="rounded-full bg-[var(--color-primary-muted)] px-2 py-0.5 text-xs text-aurora-primary"
                  >
                    {{ task.priority }}
                  </span>
                </div>
                <p class="text-sm text-aurora-text">{{ task.summary }}</p>
              </a>
            }
          }
        </div>
      }
    </section>
  `,
})
export class JiraSectionComponent {
  readonly tasks = input.required<JiraTask[]>();
  readonly open = signal(true);

  /**
   * Toggles section visibility.
   */
  toggleOpen(): void {
    this.open.update((value) => !value);
  }
}
