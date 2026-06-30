import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

/**
 * Manages Aurora theme selection and persistence.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'aurora-theme';
  readonly current = signal<Theme>('dark');

  /**
   * Applies the initial theme from storage or system preference.
   */
  init(): void {
    this.apply(this.resolveInitialTheme());
  }

  /**
   * Switches between dark and light themes.
   */
  toggle(): void {
    this.apply(this.current() === 'dark' ? 'light' : 'dark');
  }

  /**
   * Updates DOM state and persists the selected theme when storage is available.
   */
  private apply(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
    try {
      localStorage.setItem(this.storageKey, theme);
    } catch {
      // Keep theme changes usable even when browser persistence is blocked.
    }
    this.current.set(theme);
  }

  /**
   * Resolves the initial theme without failing when storage is unavailable.
   */
  private resolveInitialTheme(): Theme {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(this.storageKey);
    } catch {
      stored = null;
    }

    if (stored === 'dark' || stored === 'light') {
      return stored;
    }

    return globalThis.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
}
