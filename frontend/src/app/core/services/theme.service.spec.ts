import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let originalMatchMedia: typeof globalThis.matchMedia;

  beforeEach(() => {
    originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = jasmine
      .createSpy('matchMedia')
      .and.returnValue({ matches: false } as MediaQueryList);
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    globalThis.matchMedia = originalMatchMedia;
  });

  it('applies and persists the next theme when toggled', () => {
    const service = TestBed.inject(ThemeService);

    service.init();
    const initial = service.current();
    service.toggle();

    const expected = initial === 'dark' ? 'light' : 'dark';
    expect(service.current()).toBe(expected);
    expect(document.documentElement.getAttribute('data-theme')).toBe(expected);
    expect(localStorage.getItem('aurora-theme')).toBe(expected);
  });

  it('uses a stored theme before system preference', () => {
    localStorage.setItem('aurora-theme', 'light');
    const service = TestBed.inject(ThemeService);

    service.init();

    expect(service.current()).toBe('light');
    expect(globalThis.matchMedia).not.toHaveBeenCalled();
  });

  it('falls back to light system preference when storage has no valid theme', () => {
    localStorage.setItem('aurora-theme', 'unexpected');
    globalThis.matchMedia = jasmine
      .createSpy('matchMedia')
      .and.returnValue({ matches: true } as MediaQueryList);
    const service = TestBed.inject(ThemeService);

    service.init();

    expect(service.current()).toBe('light');
  });
});
