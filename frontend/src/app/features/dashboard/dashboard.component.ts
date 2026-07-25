import { AfterViewInit, Component, effect, inject, OnInit } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { AppIconComponent } from '../../shared/app-icon.component';
import { SourcesComponent } from '../sources/sources.component';
import { TodoListComponent } from '../todo/todo-list.component';
import { DashboardStore } from './dashboard.store';
import { SummaryChipsComponent } from './summary-chips.component';

/**
 * Main Daily Portal shell with global actions, tab navigation, and dashboard content.
 */
@Component({
  selector: 'app-dashboard',
  imports: [AppIconComponent, SummaryChipsComponent, SourcesComponent, TodoListComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, AfterViewInit {
  readonly store = inject(DashboardStore);
  readonly theme = inject(ThemeService);
  readonly todayLabel = new Intl.DateTimeFormat('es-GT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  private viewReady = false;

  constructor() {
    effect(() => {
      if (this.viewReady && this.store.activeTab() === 'fuentes' && this.store.reminderFormOpen()) {
        window.setTimeout(() =>
          document.getElementById('recordatorios')?.scrollIntoView({ behavior: 'smooth' }),
        );
      }
    });
  }

  /**
   * Loads the first digest and starts five-minute auto-refresh.
   */
  ngOnInit(): void {
    this.store.load();
  }

  /**
   * Enables scroll effects after the dashboard view exists.
   */
  ngAfterViewInit(): void {
    this.viewReady = true;
  }
}
