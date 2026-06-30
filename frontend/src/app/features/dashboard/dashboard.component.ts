import { Component, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-dashboard',
  template: `
    <main class="min-h-screen bg-aurora-bg text-aurora-text">
      <header class="border-b border-aurora-border bg-aurora-surface">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 class="text-lg font-semibold">Daily Portal</h1>
          <button
            type="button"
            class="rounded-lg border border-aurora-border px-3 py-2 text-sm text-aurora-muted"
            (click)="theme.toggle()"
          >
            Tema
          </button>
        </div>
      </header>

      <section class="mx-auto max-w-6xl px-6 py-8">
        <h2 class="text-2xl font-semibold">Hoy</h2>
        <p class="mt-2 max-w-2xl text-sm text-aurora-muted">
          Scaffolding inicial listo para conectar los módulos del plan.
        </p>
      </section>
    </main>
  `,
})
export class DashboardComponent {
  readonly theme = inject(ThemeService);
}
