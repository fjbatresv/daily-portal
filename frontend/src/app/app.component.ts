import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

/**
 * Root Angular component responsible for one-time application initialization.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent {
  private readonly theme = inject(ThemeService);

  /**
   * Initializes persisted theme state before child routes render.
   */
  constructor() {
    this.theme.init();
  }
}
