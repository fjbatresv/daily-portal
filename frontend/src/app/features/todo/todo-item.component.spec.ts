import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TodoItemComponent } from './todo-item.component';

describe('TodoItemComponent', () => {
  let fixture: ComponentFixture<TodoItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TodoItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TodoItemComponent);
    fixture.componentRef.setInput('entry', {
      id: 'reminder:reminder-1',
      acknowledged: false,
      item: {
        id: 'reminder-1',
        source: 'reminder',
        priority: 'high',
        text: 'Enviar seguimiento',
      },
    });
    fixture.detectChanges();
  });

  it('renders Spanish labels and token classes for reminder todos', () => {
    const badge = fixture.nativeElement.querySelector('span') as HTMLSpanElement;

    expect(badge.textContent?.trim()).toBe('Recordatorio');
    expect(badge.className).toContain('border-aurora-primary');
    expect(fixture.nativeElement.textContent).toContain('alta');
  });

  it('emits when the checkbox changes', () => {
    const spy = jasmine.createSpy('checkedChange');
    fixture.componentInstance.checkedChange.subscribe(spy);

    const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    checkbox.dispatchEvent(new Event('change'));

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
