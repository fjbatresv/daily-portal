import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { interval, Observable } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { DailyDigest } from '../models/daily-digest.model';

/**
 * Reads the daily dashboard digest from the backend API.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/dashboard';
  private readonly refreshMs = 300_000;

  /**
   * Fetches the current digest using backend and integration cache rules.
   */
  getDailyDigest(): Observable<DailyDigest> {
    return this.http.get<DailyDigest>(this.apiUrl);
  }

  /**
   * Forces backend cache invalidation before returning a new digest.
   */
  refreshDailyDigest(): Observable<DailyDigest> {
    return this.http.post<DailyDigest>(`${this.apiUrl}/refresh`, {});
  }

  /**
   * Emits a digest immediately and then refreshes every five minutes.
   */
  autoRefresh(): Observable<DailyDigest> {
    return interval(this.refreshMs).pipe(
      startWith(0),
      switchMap(() => this.getDailyDigest()),
    );
  }
}
