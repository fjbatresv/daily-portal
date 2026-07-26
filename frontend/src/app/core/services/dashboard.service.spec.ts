import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { DailyDigest } from '../models/daily-digest.model';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;

  const digest: DailyDigest = {
    date: '2026-07-22',
    generatedAt: '2026-07-22T14:00:00.000Z',
    todoList: [],
    tasks: [],
    prs: [],
    events: [],
    slackMentions: [],
    reminders: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the daily digest', () => {
    let response: DailyDigest | undefined;

    service.getDailyDigest().subscribe((value) => {
      response = value;
    });

    const request = httpMock.expectOne('/api/dashboard');
    expect(request.request.method).toBe('GET');
    request.flush(digest);

    expect(response).toEqual(digest);
  });

  it('forces a dashboard refresh', () => {
    service.refreshDailyDigest().subscribe();

    const request = httpMock.expectOne('/api/dashboard/refresh');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush(digest);
  });

  it('auto-refreshes immediately and every five minutes', fakeAsync(() => {
    const responses: DailyDigest[] = [];

    const subscription = service.autoRefresh().subscribe((value) => {
      responses.push(value);
    });

    const firstRequest = httpMock.expectOne('/api/dashboard');
    expect(firstRequest.request.method).toBe('GET');
    firstRequest.flush(digest);
    expect(responses.length).toBe(1);

    tick(300_000);

    const secondRequest = httpMock.expectOne('/api/dashboard');
    expect(secondRequest.request.method).toBe('GET');
    secondRequest.flush({
      ...digest,
      generatedAt: '2026-07-22T14:05:00.000Z',
    });
    expect(responses.length).toBe(2);

    subscription.unsubscribe();
  }));
});
