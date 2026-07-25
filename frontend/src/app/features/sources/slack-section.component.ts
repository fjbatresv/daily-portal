import { Component, input, signal } from '@angular/core';
import { SlackMention } from '../../core/models/daily-digest.model';
import { AppIconComponent } from '../../shared/app-icon.component';

/**
 * Shows Slack mentions with sender, channel, excerpt, and permalink.
 */
@Component({
  selector: 'app-slack-section',
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
          <app-icon name="message" className="h-4 w-4 text-integration-slack" />
          Slack
          <span class="rounded-full bg-aurora-elevated px-2 py-0.5 text-xs text-aurora-muted">{{
            mentions().length
          }}</span>
        </span>
        <app-icon
          [name]="open() ? 'chevron-down' : 'chevron-right'"
          className="h-4 w-4 text-aurora-muted"
        />
      </button>

      @if (open()) {
        <div class="space-y-3 border-t border-aurora-border px-4 py-4">
          @if (mentions().length === 0) {
            <p class="text-sm text-aurora-muted">No hay menciones recientes en Slack.</p>
          } @else {
            @for (mention of mentions(); track mention.ts) {
              <a
                class="block rounded-md border border-l-4 border-aurora-border border-l-integration-slack bg-aurora-bg p-4 transition hover:border-integration-slack"
                [href]="mention.permalink"
                target="_blank"
                rel="noreferrer"
              >
                <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-aurora-muted">
                  <span>#{{ mention.channelName }}</span>
                  <span>{{ mention.senderName }}</span>
                </div>
                <p class="truncate text-sm text-aurora-text">{{ mention.text }}</p>
              </a>
            }
          }
        </div>
      }
    </section>
  `,
})
export class SlackSectionComponent {
  readonly mentions = input.required<SlackMention[]>();
  readonly open = signal(true);

  /**
   * Toggles section visibility.
   */
  toggleOpen(): void {
    this.open.update((value) => !value);
  }
}
