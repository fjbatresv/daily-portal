import { Component, input } from '@angular/core';
import { DailyDigest } from '../../core/models/daily-digest.model';

/**
 * Displays compact counters for the main categories in the current digest.
 */
@Component({
  selector: 'app-summary-chips',
  template: `
    <div class="mb-4 flex flex-wrap gap-2">
      @if (urgentCount() > 0) {
        <span
          class="rounded-full bg-[var(--color-error-muted)] px-3 py-1 text-sm text-[var(--color-error-text)]"
        >
          {{ urgentCount() }} urgentes
        </span>
      }
      @if (digest().tasks.length > 0) {
        <span
          class="rounded-full bg-[var(--color-primary-muted)] px-3 py-1 text-sm text-aurora-primary"
        >
          {{ digest().tasks.length }} tareas
        </span>
      }
      @if (digest().events.length > 0) {
        <span
          class="rounded-full bg-[var(--color-info-muted)] px-3 py-1 text-sm text-[var(--color-info-text)]"
        >
          {{ digest().events.length }} eventos
        </span>
      }
      @if (digest().slackMentions.length > 0) {
        <span
          class="rounded-full bg-[var(--color-warning-muted)] px-3 py-1 text-sm text-[var(--color-warning-text)]"
        >
          {{ digest().slackMentions.length }} menciones
        </span>
      }
    </div>
  `,
})
export class SummaryChipsComponent {
  readonly digest = input.required<DailyDigest>();

  /**
   * Counts PR states that need same-day attention.
   */
  urgentCount(): number {
    return this.digest().prs.filter(
      (pr) => pr.hasConflicts || pr.checkStatus === 'failure' || pr.hasNewComments,
    ).length;
  }
}
