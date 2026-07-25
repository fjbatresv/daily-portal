import { Component, input, signal } from '@angular/core';
import { CalendarEvent } from '../../core/models/daily-digest.model';
import { AppIconComponent } from '../../shared/app-icon.component';

/**
 * Shows calendar events as a compact timeline.
 */
@Component({
  selector: 'app-calendar-section',
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
          <app-icon name="calendar" className="h-4 w-4 text-integration-calendar" />
          Calendario
          <span class="rounded-full bg-aurora-elevated px-2 py-0.5 text-xs text-aurora-muted">{{
            events().length
          }}</span>
        </span>
        <app-icon
          [name]="open() ? 'chevron-down' : 'chevron-right'"
          className="h-4 w-4 text-aurora-muted"
        />
      </button>

      @if (open()) {
        <div class="space-y-3 border-t border-aurora-border px-4 py-4">
          @if (events().length === 0) {
            <p class="text-sm text-aurora-muted">No hay eventos próximos en el calendario.</p>
          } @else {
            @for (event of events(); track event.id) {
              <div class="relative border-l-2 border-integration-calendar bg-aurora-bg py-3 pl-4">
                <span
                  class="absolute -left-[5px] top-5 h-2 w-2 rounded-full bg-integration-calendar"
                ></span>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-mono text-sm text-integration-calendar">{{
                    eventTime(event)
                  }}</span>
                  <span
                    class="rounded-full bg-[var(--color-info-muted)] px-2 py-0.5 text-xs text-[var(--color-info-text)]"
                  >
                    {{ event.calendarName }}
                  </span>
                  @if (event.meetUrl) {
                    <a
                      class="inline-flex items-center gap-1 rounded-md border border-aurora-border px-2 py-1 text-xs text-aurora-muted hover:border-integration-calendar hover:text-aurora-text"
                      [href]="event.meetUrl"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <app-icon name="video" className="h-3.5 w-3.5" />
                      Meet
                    </a>
                  }
                </div>
                <p class="mt-2 text-sm font-medium text-aurora-text">{{ event.title }}</p>
              </div>
            }
          }
        </div>
      }
    </section>
  `,
})
export class CalendarSectionComponent {
  readonly events = input.required<CalendarEvent[]>();
  readonly open = signal(true);

  /**
   * Toggles section visibility.
   */
  toggleOpen(): void {
    this.open.update((value) => !value);
  }

  /**
   * Formats event start time for the timeline.
   */
  eventTime(event: CalendarEvent): string {
    if (event.isAllDay) {
      return 'Todo el dia';
    }

    return new Date(event.startTime).toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
