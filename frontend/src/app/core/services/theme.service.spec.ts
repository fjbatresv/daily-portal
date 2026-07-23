import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
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
});
