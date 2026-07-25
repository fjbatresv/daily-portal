import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Reminder } from '../../../core/models/daily-digest.model';
import { DashboardStore } from '../../dashboard/dashboard.store';
import { RemindersSectionComponent } from './reminders-section.component';

const reminders: Reminder[] = [
  {
    id: 'low',
    text: 'Baja',
    date: '2026-07-24',
    priority: 'low',
    completed: false,
    createdAt: '2026-07-24T10:00:00.000Z',
    updatedAt: '2026-07-24T10:00:00.000Z',
    daysOverdue: 0,
    escalatedPriority: 'low',
  },
  {
    id: 'high',
    text: 'Alta',
    date: '2026-07-20',
    priority: 'medium',
    completed: false,
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
    daysOverdue: 4,
    escalatedPriority: 'high',
  },
  {
    id: 'done',
    text: 'Hecho',
    date: '2026-07-24',
    priority: 'high',
    completed: true,
    createdAt: '2026-07-24T10:00:00.000Z',
    updatedAt: '2026-07-24T10:00:00.000Z',
    daysOverdue: 0,
    escalatedPriority: 'high',
  },
];

describe('RemindersSectionComponent', () => {
  let fixture: ComponentFixture<RemindersSectionComponent>;
  let store: jasmine.SpyObj<DashboardStore>;

  beforeEach(async () => {
    store = jasmine.createSpyObj<DashboardStore>('DashboardStore', ['addReminder'], {
      reminderFormOpen: signal(false),
    });

    await TestBed.configureTestingModule({
      imports: [RemindersSectionComponent],
      providers: [{ provide: DashboardStore, useValue: store }],
    }).compileComponents();

    fixture = TestBed.createComponent(RemindersSectionComponent);
    fixture.componentRef.setInput('reminders', reminders);
    fixture.detectChanges();
  });

  it('orders pending reminders by escalated priority and hides completed ones', () => {
    expect(fixture.componentInstance.pendingReminders().map((reminder) => reminder.id)).toEqual([
      'high',
      'low',
    ]);
  });

  it('exposes disclosure state to assistive technology', () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the section before showing the reminder form', () => {
    fixture.componentInstance.open.set(false);

    fixture.componentInstance.openReminderForm();

    expect(fixture.componentInstance.open()).toBe(true);
    expect(store.reminderFormOpen()).toBe(true);
  });
});
