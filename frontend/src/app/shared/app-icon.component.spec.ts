import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppIconComponent } from './app-icon.component';

describe('AppIconComponent', () => {
  let fixture: ComponentFixture<AppIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppIconComponent);
    fixture.componentRef.setInput('name', 'loader');
  });

  it('uses the default class without spin', () => {
    fixture.detectChanges();

    expect(fixture.componentInstance.iconClass()).toBe('h-4 w-4');
    expect(fixture.componentInstance.path()).toContain('M21 12');
  });

  it('adds animation class when spin is enabled', () => {
    fixture.componentRef.setInput('className', 'h-5 w-5');
    fixture.componentRef.setInput('spin', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.iconClass()).toBe('h-5 w-5 animate-spin');
  });
});
