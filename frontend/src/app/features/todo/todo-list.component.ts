import { Component, computed, inject } from '@angular/core';
import { DashboardStore } from '../dashboard/dashboard.store';
import { TodoItemComponent } from './todo-item.component';

type TodoEntry = ReturnType<DashboardStore['todoItems']>[number];

/**
 * Renders pending TODO items first and acknowledged items in an undoable section.
 */
@Component({
  selector: 'app-todo-list',
  imports: [TodoItemComponent],
  templateUrl: './todo-list.component.html',
})
export class TodoListComponent {
  readonly store = inject(DashboardStore);

  /**
   * Returns TODO entries that still need attention.
   */
  readonly pendingItems = computed<TodoEntry[]>(() =>
    this.store.todoItems().filter((item) => !item.acknowledged),
  );

  /**
   * Returns locally acknowledged entries for the undo section.
   */
  readonly acknowledgedItems = computed<TodoEntry[]>(() =>
    this.store.todoItems().filter((item) => item.acknowledged),
  );

  /**
   * Marks a TODO entry as acknowledged and completes reminders through the store.
   */
  acknowledge(todoId: string): void {
    this.store.acknowledge(todoId)?.subscribe({
      error: () => this.store.undo(todoId),
    });
  }
}
