import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { Theme, ThemeService } from '../../core/services/theme.service';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let theme: jasmine.SpyObj<ThemeService> & { current: ReturnType<typeof signal<Theme>> };

  beforeEach(async () => {
    theme = jasmine.createSpyObj<ThemeService>('ThemeService', ['toggle'], {
      current: signal<Theme>('dark'),
    }) as jasmine.SpyObj<ThemeService> & { current: ReturnType<typeof signal<Theme>> };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: ThemeService, useValue: theme }],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  });

  it('renders the portal shell', () => {
    const title = fixture.nativeElement.querySelector('h1') as HTMLHeadingElement;

    expect(title.textContent?.trim()).toBe('Daily Portal');
  });

  it('describes and toggles the current theme', () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Cambiar a tema claro');

    button.click();

    expect(theme.toggle).toHaveBeenCalledTimes(1);
  });
});
