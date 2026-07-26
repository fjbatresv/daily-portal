import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { Reminder } from '../../../core/models/daily-digest.model';
import { RemindersService } from '../../../core/services/reminders.service';
import { DashboardStore } from '../../dashboard/dashboard.store';
import { ReminderFormComponent } from './reminder-form.component';

const reminder: Reminder = {
  id: 'reminder-1',
  text: 'Enviar seguimiento',
  date: '2026-07-25',
  priority: 'medium',
  completed: false,
  createdAt: '2026-07-24T10:00:00.000Z',
  updatedAt: '2026-07-24T10:00:00.000Z',
  daysOverdue: 0,
  escalatedPriority: 'medium',
};

describe('ReminderFormComponent', () => {
  let fixture: ComponentFixture<ReminderFormComponent>;
  let reminders: jasmine.SpyObj<RemindersService>;
  let store: jasmine.SpyObj<DashboardStore>;

  beforeEach(async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 6, 24, 23, 30));
    reminders = jasmine.createSpyObj<RemindersService>('RemindersService', ['create']);
    const reminderFormOpen = signal(false);
    spyOn(reminderFormOpen, 'set').and.callThrough();
    store = jasmine.createSpyObj<DashboardStore>('DashboardStore', [], {
      reminderFormOpen,
    });

    await TestBed.configureTestingModule({
      imports: [ReminderFormComponent],
      providers: [
        { provide: RemindersService, useValue: reminders },
        { provide: DashboardStore, useValue: store },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReminderFormComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('defaults the date to local tomorrow', () => {
    expect(fixture.componentInstance.form.controls.date.value).toBe('2026-07-25');
  });

  it('creates a reminder and closes the form', () => {
    const created = jasmine.createSpy('created');
    reminders.create.and.returnValue(of(reminder));
    fixture.componentInstance.created.subscribe(created);
    fixture.componentInstance.form.setValue({
      text: 'Enviar seguimiento',
      date: '2026-07-25',
      priority: 'medium',
    });

    fixture.componentInstance.submit();

    expect(reminders.create).toHaveBeenCalledOnceWith({
      text: 'Enviar seguimiento',
      date: '2026-07-25',
      priority: 'medium',
    });
    expect(created).toHaveBeenCalledOnceWith(reminder);
    expect(store.reminderFormOpen.set).toHaveBeenCalledWith(false);
  });

  it('shows an error when creation fails', () => {
    reminders.create.and.returnValue(throwError(() => new Error('offline')));
    fixture.componentInstance.form.setValue({
      text: 'Enviar seguimiento',
      date: '2026-07-25',
      priority: 'medium',
    });

    fixture.componentInstance.submit();

    expect(fixture.componentInstance.error()).toBe('No se pudo crear el recordatorio.');
  });

  it('marks invalid controls and skips the request', () => {
    fixture.componentInstance.form.controls.text.setValue('');

    fixture.componentInstance.submit();

    expect(reminders.create).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.text.touched).toBe(true);
  });
});
