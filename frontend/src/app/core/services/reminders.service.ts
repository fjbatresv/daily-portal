import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateReminderDto, Reminder, UpdateReminderDto } from '../models/daily-digest.model';

/**
 * Provides HTTP operations for creating and managing reminders.
 */
@Injectable({ providedIn: 'root' })
export class RemindersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/reminders';

  /**
   * Lists reminders for today, a specific date, or all persisted rows.
   */
  list(date?: string, all = false): Observable<Reminder[]> {
    let params = new HttpParams();

    if (date !== undefined) {
      params = params.set('date', date);
    }

    if (all) {
      params = params.set('all', 'true');
    }

    return this.http.get<Reminder[]>(this.apiUrl, { params });
  }

  /**
   * Creates a reminder.
   */
  create(dto: CreateReminderDto): Observable<Reminder> {
    return this.http.post<Reminder>(this.apiUrl, dto);
  }

  /**
   * Updates a reminder with a partial payload.
   */
  update(id: string, dto: UpdateReminderDto): Observable<Reminder> {
    return this.http.patch<Reminder>(`${this.apiUrl}/${id}`, dto);
  }

  /**
   * Marks a reminder as completed.
   */
  complete(id: string): Observable<Reminder> {
    return this.http.patch<Reminder>(`${this.apiUrl}/${id}/complete`, {});
  }

  /**
   * Deletes a reminder.
   */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
