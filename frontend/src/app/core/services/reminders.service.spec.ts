import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CreateReminderDto, Reminder, UpdateReminderDto } from '../models/daily-digest.model';
import { RemindersService } from './reminders.service';

describe('RemindersService', () => {
  let service: RemindersService;
  let httpMock: HttpTestingController;

  const reminder: Reminder = {
    id: 'reminder-1',
    text: 'Enviar propuesta tecnica',
    date: '2026-07-23',
    priority: 'medium',
    completed: false,
    createdAt: '2026-07-22T14:00:00.000Z',
    updatedAt: '2026-07-22T14:00:00.000Z',
    daysOverdue: 0,
    escalatedPriority: 'medium',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(RemindersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists reminders with optional filters', () => {
    let response: Reminder[] | undefined;

    service.list('2026-07-23', true).subscribe((value) => {
      response = value;
    });

    const request = httpMock.expectOne(
      (candidate) =>
        candidate.url === '/api/reminders' &&
        candidate.params.get('date') === '2026-07-23' &&
        candidate.params.get('all') === 'true',
    );
    expect(request.request.method).toBe('GET');
    request.flush([reminder]);

    expect(response).toEqual([reminder]);
  });

  it('creates reminders', () => {
    const dto: CreateReminderDto = {
      text: 'Enviar propuesta tecnica',
      date: '2026-07-23',
      priority: 'medium',
    };

    service.create(dto).subscribe();

    const request = httpMock.expectOne('/api/reminders');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(dto);
    request.flush(reminder);
  });

  it('updates reminders', () => {
    const dto: UpdateReminderDto = {
      priority: 'high',
    };

    service.update('reminder-1', dto).subscribe();

    const request = httpMock.expectOne('/api/reminders/reminder-1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(dto);
    request.flush({ ...reminder, priority: 'high', escalatedPriority: 'high' });
  });

  it('marks reminders as completed', () => {
    service.complete('reminder-1').subscribe();

    const request = httpMock.expectOne('/api/reminders/reminder-1/complete');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});
    request.flush({ ...reminder, completed: true });
  });

  it('deletes reminders', () => {
    service.delete('reminder-1').subscribe();

    const request = httpMock.expectOne('/api/reminders/reminder-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});
