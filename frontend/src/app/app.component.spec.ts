import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { ThemeService } from './core/services/theme.service';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let theme: jasmine.SpyObj<ThemeService>;

  beforeEach(async () => {
    theme = jasmine.createSpyObj<ThemeService>('ThemeService', ['init']);

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), { provide: ThemeService, useValue: theme }],
    }).compileComponents();
  });

  it('initializes the theme service on creation', () => {
    fixture = TestBed.createComponent(AppComponent);

    expect(fixture.componentInstance).toBeTruthy();
    expect(theme.init).toHaveBeenCalledTimes(1);
  });
});
