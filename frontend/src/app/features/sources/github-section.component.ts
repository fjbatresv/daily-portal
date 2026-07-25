import { Component, input, signal } from '@angular/core';
import { GitHubPR } from '../../core/models/daily-digest.model';
import { AppIconComponent } from '../../shared/app-icon.component';

/**
 * Shows GitHub pull requests with review, conflict, and check status badges.
 */
@Component({
  selector: 'app-github-section',
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
          <app-icon name="github" className="h-4 w-4 text-integration-github" />
          GitHub PRs
          <span class="rounded-full bg-aurora-elevated px-2 py-0.5 text-xs text-aurora-muted">{{
            prs().length
          }}</span>
        </span>
        <app-icon
          [name]="open() ? 'chevron-down' : 'chevron-right'"
          className="h-4 w-4 text-aurora-muted"
        />
      </button>

      @if (open()) {
        <div class="space-y-3 border-t border-aurora-border px-4 py-4">
          @if (prs().length === 0) {
            <p class="text-sm text-aurora-muted">No hay pull requests abiertos para revisar.</p>
          } @else {
            @for (pr of prs(); track pr.id) {
              <a
                class="block rounded-md border border-aurora-border bg-aurora-bg p-4 transition hover:border-integration-github"
                [href]="pr.url"
                target="_blank"
                rel="noreferrer"
              >
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="text-xs text-aurora-muted">{{ pr.repo }}</span>
                  @if (pr.hasConflicts) {
                    <span
                      class="rounded-full bg-[var(--color-error-muted)] px-2 py-0.5 text-xs text-[var(--color-error-text)]"
                    >
                      conflictos
                    </span>
                  }
                  @if (pr.checkStatus === 'failure' || pr.checkStatus === 'error') {
                    <span
                      class="rounded-full bg-[var(--color-error-muted)] px-2 py-0.5 text-xs text-[var(--color-error-text)]"
                    >
                      checks
                    </span>
                  } @else if (pr.checkStatus === 'pending') {
                    <span
                      class="rounded-full bg-[var(--color-warning-muted)] px-2 py-0.5 text-xs text-[var(--color-warning-text)]"
                    >
                      pending
                    </span>
                  } @else {
                    <span
                      class="rounded-full bg-[var(--color-success-muted)] px-2 py-0.5 text-xs text-[var(--color-success-text)]"
                    >
                      ok
                    </span>
                  }
                  @if (pr.hasNewComments) {
                    <span
                      class="rounded-full bg-[var(--color-warning-muted)] px-2 py-0.5 text-xs text-[var(--color-warning-text)]"
                    >
                      comentarios
                    </span>
                  }
                  @if (pr.isDraft) {
                    <span
                      class="rounded-full bg-aurora-elevated px-2 py-0.5 text-xs text-aurora-muted"
                      >draft</span
                    >
                  }
                </div>
                <p class="text-sm font-medium text-aurora-text">{{ pr.title }}</p>
              </a>
            }
          }
        </div>
      }
    </section>
  `,
})
export class GitHubSectionComponent {
  readonly prs = input.required<GitHubPR[]>();
  readonly open = signal(true);

  /**
   * Toggles section visibility.
   */
  toggleOpen(): void {
    this.open.update((value) => !value);
  }
}
