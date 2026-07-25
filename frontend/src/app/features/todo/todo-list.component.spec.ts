import { ComponentFixture, TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { DashboardStore } from '../dashboard/dashboard.store';
import { TodoListComponent } from './todo-list.component';

describe('TodoListComponent', () => {
  let fixture: ComponentFixture<TodoListComponent>;
  let store: jasmine.SpyObj<DashboardStore>;

  beforeEach(async () => {
    store = jasmine.createSpyObj<DashboardStore>('DashboardStore', [
      'todoItems',
      'acknowledge',
      'undo',
    ]);
    store.todoItems.and.returnValue([
      {
        id: 'jira:1:Tarea',
        acknowledged: false,
        reminder: undefined,
        item: { source: 'jira', priority: 'medium', text: 'Tarea' },
      },
      {
        id: 'slack:2:Mensaje',
        acknowledged: true,
        reminder: undefined,
        item: { source: 'slack', priority: 'low', text: 'Mensaje' },
      },
    ]);
    store.acknowledge.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [TodoListComponent],
      providers: [{ provide: DashboardStore, useValue: store }],
    }).compileComponents();

    fixture = TestBed.createComponent(TodoListComponent);
    fixture.detectChanges();
  });

  it('separates pending and acknowledged entries with computed signals', () => {
    expect(fixture.componentInstance.pendingItems().map((entry) => entry.id)).toEqual([
      'jira:1:Tarea',
    ]);
    expect(fixture.componentInstance.acknowledgedItems().map((entry) => entry.id)).toEqual([
      'slack:2:Mensaje',
    ]);
    expect(fixture.nativeElement.textContent).toContain('1 atendidos');
  });

  it('undoes a reminder acknowledgement when the complete request fails', () => {
    store.acknowledge.and.returnValue(throwError(() => new Error('failed')));

    fixture.componentInstance.acknowledge('reminder:1');

    expect(store.undo).toHaveBeenCalledOnceWith('reminder:1');
  });

  it('leaves local-only acknowledgement without a subscription', () => {
    store.acknowledge.and.returnValue(null);

    fixture.componentInstance.acknowledge('jira:1:Tarea');

    expect(store.acknowledge).toHaveBeenCalledOnceWith('jira:1:Tarea');
  });
});
