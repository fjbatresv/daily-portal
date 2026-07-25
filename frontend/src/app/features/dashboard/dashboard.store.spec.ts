import { TestBed } from '@angular/core/testing';
import { Observable, of, Subscriber, throwError } from 'rxjs';
import { DailyDigest, Reminder } from '../../core/models/daily-digest.model';
import { DashboardService } from '../../core/services/dashboard.service';
import { RemindersService } from '../../core/services/reminders.service';
import { DashboardStore } from './dashboard.store';

const reminderOne: Reminder = {
  id: 'reminder-1',
  text: 'Enviar seguimiento',
  date: '2026-07-24',
  priority: 'medium',
  completed: false,
  createdAt: '2026-07-24T10:00:00.000Z',
  updatedAt: '2026-07-24T10:00:00.000Z',
  daysOverdue: 0,
  escalatedPriority: 'medium',
};

const reminderTwo: Reminder = {
  ...reminderOne,
  id: 'reminder-2',
  createdAt: '2026-07-24T11:00:00.000Z',
  updatedAt: '2026-07-24T11:00:00.000Z',
};

function digest(overrides: Partial<DailyDigest> = {}): DailyDigest {
  return {
    date: '2026-07-24',
    generatedAt: '2026-07-24T14:00:00.000Z',
    todoList: [],
    tasks: [],
    prs: [],
    events: [],
    slackMentions: [],
    reminders: [],
    ...overrides,
  };
}

describe('DashboardStore', () => {
  let store: DashboardStore;
  let dashboard: jasmine.SpyObj<DashboardService>;
  let reminders: jasmine.SpyObj<RemindersService>;

  beforeEach(() => {
    dashboard = jasmine.createSpyObj<DashboardService>('DashboardService', [
      'autoRefresh',
      'refreshDailyDigest',
    ]);
    reminders = jasmine.createSpyObj<RemindersService>('RemindersService', ['complete']);

    TestBed.configureTestingModule({
      providers: [
        DashboardStore,
        { provide: DashboardService, useValue: dashboard },
        { provide: RemindersService, useValue: reminders },
      ],
    });

    localStorage.clear();
    store = TestBed.inject(DashboardStore);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('replaces an existing auto-refresh subscription when load runs again', () => {
    let unsubscribeCount = 0;
    const subscribers: Subscriber<DailyDigest>[] = [];

    dashboard.autoRefresh.and.returnValue(
      new Observable<DailyDigest>((subscriber) => {
        subscribers.push(subscriber);
        return () => {
          unsubscribeCount += 1;
        };
      }),
    );

    store.load();
    store.load();
    subscribers[1].next(digest());

    expect(dashboard.autoRefresh).toHaveBeenCalledTimes(2);
    expect(unsubscribeCount).toBe(1);
    expect(store.loading()).toBe(false);
    expect(store.digest()?.date).toBe('2026-07-24');
  });

  it('keeps a fallback digest when auto-refresh fails', () => {
    dashboard.autoRefresh.and.returnValue(throwError(() => new Error('offline')));

    store.load();

    expect(store.error()).toBe('No se pudo cargar el dashboard.');
    expect(store.digest()).not.toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('uses the portal timezone date for fallback digest acknowledgement keys', () => {
    dashboard.autoRefresh.and.returnValue(throwError(() => new Error('offline')));
    localStorage.setItem('portal:acknowledged:2026-07-24', JSON.stringify(['jira:1:Tarea']));
    jasmine.clock().install();

    try {
      jasmine.clock().mockDate(new Date('2026-07-25T03:30:00.000Z'));
      store.load();
    } finally {
      jasmine.clock().uninstall();
    }

    expect(store.digest()?.date).toBe('2026-07-24');
    expect(store.acknowledged()).toEqual(new Set(['jira:1:Tarea']));
  });

  it('returns an empty todo list before a digest is available', () => {
    expect(store.todoItems()).toEqual([]);
    expect(store.pendingTodoCount()).toBe(0);
  });

  it('refreshes digest data and reports refresh errors without losing existing state', () => {
    dashboard.refreshDailyDigest.and.returnValues(
      of(digest({ date: '2026-07-25' })),
      throwError(() => new Error('offline')),
    );

    store.refresh();
    expect(store.digest()?.date).toBe('2026-07-25');
    expect(store.refreshing()).toBe(false);

    store.refresh();
    expect(store.error()).toBe('No se pudo refrescar el dashboard.');
    expect(store.digest()?.date).toBe('2026-07-25');
  });

  it('opens the sources tab and reminder form together', () => {
    store.openReminderForm();

    expect(store.activeTab()).toBe('fuentes');
    expect(store.reminderFormOpen()).toBe(true);
  });

  it('completes the exact reminder identified by the todo item id', () => {
    const completed = { ...reminderTwo, completed: true };
    reminders.complete.and.returnValue(of(completed));
    store.digest.set(
      digest({
        reminders: [reminderOne, reminderTwo],
        todoList: [
          {
            id: 'reminder-2',
            source: 'reminder',
            priority: 'medium',
            text: 'Enviar seguimiento',
          },
        ],
      }),
    );

    const request = store.acknowledge('reminder:reminder-2');

    request?.subscribe();
    expect(reminders.complete).toHaveBeenCalledOnceWith('reminder-2');
    expect(store.todoItems()[0].acknowledged).toBe(true);
  });

  it('returns null when acknowledging an unknown todo id', () => {
    store.digest.set(digest());

    expect(store.acknowledge('missing')).toBeNull();
  });

  it('adds a newly created reminder to the current digest with its stable todo id', () => {
    store.digest.set(digest());

    store.addReminder(reminderOne);

    expect(store.digest()?.reminders).toEqual([reminderOne]);
    expect(store.digest()?.todoList).toEqual([
      {
        id: 'reminder-1',
        source: 'reminder',
        priority: 'medium',
        text: 'Enviar seguimiento',
      },
    ]);
  });

  it('does not add completed reminders or mutate a missing digest', () => {
    store.addReminder(reminderOne);
    expect(store.digest()).toBeNull();

    store.digest.set(digest());
    store.addReminder({ ...reminderOne, completed: true });

    expect(store.digest()?.reminders.length).toBe(1);
    expect(store.digest()?.todoList).toEqual([]);
  });

  it('creates stable ids for explicit source ids and fallback metadata', () => {
    expect(
      store.todoId(
        {
          id: 'event-1',
          source: 'calendar',
          priority: 'medium',
          text: 'Standup',
        },
        0,
      ),
    ).toBe('calendar:event-1');
    expect(
      store.todoId(
        {
          source: 'calendar',
          priority: 'medium',
          text: 'Standup',
          dueTime: '09:00',
        },
        0,
      ),
    ).toBe('calendar:09:00:Standup');
    expect(
      store.todoId(
        {
          source: 'jira',
          priority: 'low',
          text: 'Sin metadata',
        },
        4,
      ),
    ).toBe('jira:4:Sin metadata');
  });

  it('persists non-reminder acknowledgements by digest date', () => {
    store.digest.set(
      digest({
        todoList: [
          {
            source: 'github',
            priority: 'high',
            text: 'Checks fallando',
            url: 'https://github.example.com/pr/1',
          },
        ],
      }),
    );

    store.acknowledge('github:https://github.example.com/pr/1:Checks fallando');

    expect(localStorage.getItem('portal:acknowledged:2026-07-24')).toContain(
      'github:https://github.example.com/pr/1:Checks fallando',
    );
  });

  it('loads current acknowledgements and removes stale date buckets', () => {
    localStorage.setItem('portal:acknowledged:2026-07-23', JSON.stringify(['old']));
    localStorage.setItem('portal:acknowledged:2026-07-24', JSON.stringify(['jira:1:Tarea']));
    dashboard.autoRefresh.and.returnValue(of(digest()));

    store.load();

    expect(store.acknowledged()).toEqual(new Set(['jira:1:Tarea']));
    expect(localStorage.getItem('portal:acknowledged:2026-07-23')).toBeNull();
  });

  it('undoes both reminder and local acknowledgements', () => {
    store.digest.set(digest());
    store.acknowledged.set(new Set(['jira:1:Tarea']));
    store.reminderAcknowledged.set(new Set(['reminder:reminder-1']));

    store.undo('jira:1:Tarea');
    store.undo('reminder:reminder-1');

    expect(store.acknowledged().size).toBe(0);
    expect(store.reminderAcknowledged().size).toBe(0);
  });
});
