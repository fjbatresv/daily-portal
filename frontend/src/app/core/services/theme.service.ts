import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'aurora-theme';
  readonly current = signal<Theme>('dark');

  init(): void {
    this.apply(this.resolveInitialTheme());
  }

  toggle(): void {
    this.apply(this.current() === 'dark' ? 'light' : 'dark');
  }

  private apply(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
    try {
      localStorage.setItem(this.storageKey, theme);
    } catch {
      // Keep theme changes usable even when browser persistence is blocked.
    }
    this.current.set(theme);
  }

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
