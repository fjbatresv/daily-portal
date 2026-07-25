import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import axe from 'axe-core';
import { DashboardComponent } from './dashboard.component';
import { Theme, ThemeService } from '../../core/services/theme.service';
import { DashboardStore } from './dashboard.store';
import { DailyDigest } from '../../core/models/daily-digest.model';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let theme: jasmine.SpyObj<ThemeService> & { current: ReturnType<typeof signal<Theme>> };
  let store: jasmine.SpyObj<DashboardStore>;

  const digest: DailyDigest = {
    date: '2026-07-24',
    generatedAt: '2026-07-24T14:00:00.000Z',
    todoList: [],
    tasks: [],
    prs: [],
    events: [],
    slackMentions: [],
    reminders: [],
  };

  beforeEach(async () => {
    theme = jasmine.createSpyObj<ThemeService>('ThemeService', ['toggle'], {
      current: signal<Theme>('dark'),
    }) as jasmine.SpyObj<ThemeService> & { current: ReturnType<typeof signal<Theme>> };
    store = jasmine.createSpyObj<DashboardStore>(
      'DashboardStore',
      ['load', 'refresh', 'openReminderForm', 'todoItems'],
      {
        digest: signal<DailyDigest | null>(digest),
        loading: signal(false),
        refreshing: signal(false),
        error: signal<string | null>(null),
        activeTab: signal<'hoy' | 'fuentes'>('hoy'),
        reminderFormOpen: signal(false),
        pendingTodoCount: signal(0),
      },
    );
    store.todoItems.and.returnValue([]);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ThemeService, useValue: theme },
        { provide: DashboardStore, useValue: store },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  });

  it('renders the portal shell', () => {
    const title = fixture.nativeElement.querySelector('h1') as HTMLHeadingElement;

    expect(title.textContent?.trim()).toBe('Daily Portal');
    expect(store.load).toHaveBeenCalledTimes(1);
  });

  it('describes and toggles the current theme', () => {
    const button = fixture.nativeElement.querySelector(
      'button[aria-label="Cambiar a tema claro"]',
    ) as HTMLButtonElement;

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Cambiar a tema claro');

    button.click();

    expect(theme.toggle).toHaveBeenCalledTimes(1);
  });

  it('opens the reminder flow from the global header action', () => {
    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    const button = Array.from(buttons).find(
      (candidate) => candidate.textContent?.includes('Recordatorio') === true,
    );

    button?.click();

    expect(store.openReminderForm).toHaveBeenCalledTimes(1);
  });

  it('has no detectable accessibility violations in the dashboard shell', async () => {
    const results = await axe.run(fixture.nativeElement, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
  });
});
