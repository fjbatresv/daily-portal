import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CreateReminderDto, Priority, Reminder } from '../../../core/models/daily-digest.model';
import { RemindersService } from '../../../core/services/reminders.service';
import { AppIconComponent } from '../../../shared/app-icon.component';
import { DashboardStore } from '../../dashboard/dashboard.store';

/**
 * Inline form for creating reminders with date and initial priority.
 */
@Component({
  selector: 'app-reminder-form',
  imports: [AppIconComponent, ReactiveFormsModule],
  template: `
    <form
      class="rounded-md border border-aurora-border bg-aurora-bg p-4"
      [formGroup]="form"
      (ngSubmit)="submit()"
    >
      <label class="block text-sm font-medium text-aurora-text" for="reminder-text">Texto</label>
      <textarea
        id="reminder-text"
        class="mt-2 min-h-24 w-full rounded-md border border-aurora-border bg-aurora-surface px-3 py-2 text-sm text-aurora-text outline-none focus:border-aurora-primary"
        formControlName="text"
        maxlength="500"
      ></textarea>
      @if (form.controls.text.invalid && form.controls.text.touched) {
        <p class="mt-1 text-xs text-[var(--color-error-text)]">El texto es requerido.</p>
      }
      @if (error(); as message) {
        <p class="mt-2 text-xs text-[var(--color-error-text)]" role="alert">{{ message }}</p>
      }

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <label class="block text-sm font-medium text-aurora-text">
          Fecha
          <input
            class="mt-2 w-full rounded-md border border-aurora-border bg-aurora-surface px-3 py-2 text-sm text-aurora-text outline-none focus:border-aurora-primary"
            type="date"
            formControlName="date"
          />
        </label>

        <label class="block text-sm font-medium text-aurora-text">
          Prioridad
          <select
            class="mt-2 w-full rounded-md border border-aurora-border bg-aurora-surface px-3 py-2 text-sm text-aurora-text outline-none focus:border-aurora-primary"
            formControlName="priority"
          >
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </select>
        </label>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-aurora-border px-3 py-2 text-sm text-aurora-muted hover:border-aurora-primary hover:text-aurora-text"
          (click)="cancel()"
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="inline-flex items-center gap-2 rounded-md bg-aurora-primary px-3 py-2 text-sm font-medium text-aurora-bg disabled:opacity-50"
          [disabled]="saving()"
        >
          @if (saving()) {
            <app-icon name="loader" [spin]="true" />
          }
          Guardar
        </button>
      </div>
    </form>
  `,
})
export class ReminderFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly reminders = inject(RemindersService);
  private readonly store = inject(DashboardStore);

  readonly created = output<Reminder>();
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.maxLength(500)]],
    date: [this.tomorrowIso(), [Validators.required]],
    priority: ['medium' as Priority, [Validators.required]],
  });

  /**
   * Submits a valid reminder and collapses the inline form on success.
   */
  submit(): void {
    if (this.form.invalid) {
      this.error.set(null);
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const dto: CreateReminderDto = this.form.getRawValue();

    this.reminders
      .create(dto)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (reminder) => {
          this.created.emit(reminder);
          this.store.reminderFormOpen.set(false);
          this.form.reset({ text: '', date: this.tomorrowIso(), priority: 'medium' });
        },
        error: () => this.error.set('No se pudo crear el recordatorio.'),
      });
  }

  /**
   * Closes the form without sending data.
   */
  cancel(): void {
    this.error.set(null);
    this.store.reminderFormOpen.set(false);
    this.form.reset({ text: '', date: this.tomorrowIso(), priority: 'medium' });
  }

  private tomorrowIso(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = `${tomorrow.getMonth() + 1}`.padStart(2, '0');
    const day = `${tomorrow.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
