import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarSectionComponent } from './calendar-section.component';
import { GitHubSectionComponent } from './github-section.component';
import { JiraSectionComponent } from './jira-section.component';
import { SlackSectionComponent } from './slack-section.component';

describe('source section disclosure components', () => {
  it('toggles Jira disclosure state and exposes aria-expanded', async () => {
    await TestBed.configureTestingModule({
      imports: [JiraSectionComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(JiraSectionComponent);
    fixture.componentRef.setInput('tasks', [
      {
        id: 'jira-1',
        key: 'TEMP-1',
        summary: 'Implementar',
        status: 'In Progress',
        priority: 'High',
        url: 'https://jira.example.com/TEMP-1',
      },
    ]);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders GitHub status badges and toggles open state', async () => {
    await TestBed.configureTestingModule({
      imports: [GitHubSectionComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(GitHubSectionComponent);
    fixture.componentRef.setInput('prs', [
      {
        id: 1,
        title: 'Frontend dashboard',
        url: 'https://github.example.com/pr/1',
        repo: 'daily-portal',
        status: 'open',
        isDraft: true,
        hasNewComments: true,
        checkStatus: 'pending',
        hasConflicts: true,
        updatedAt: '2026-07-24T12:00:00.000Z',
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('conflictos');
    expect(fixture.nativeElement.textContent).toContain('pending');
    expect(fixture.nativeElement.textContent).toContain('comentarios');
    expect(fixture.nativeElement.textContent).toContain('draft');

    fixture.componentInstance.toggleOpen();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('formats all-day and timed calendar events', async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarSectionComponent],
    }).compileComponents();
    const fixture: ComponentFixture<CalendarSectionComponent> =
      TestBed.createComponent(CalendarSectionComponent);
    const timedEvent = {
      id: 'event-1',
      title: 'Standup',
      startTime: '2026-07-24T14:00:00.000Z',
      endTime: '2026-07-24T14:30:00.000Z',
      calendarId: 'primary',
      calendarName: 'Primary',
      isAllDay: false,
      meetUrl: 'https://meet.example.com/abc',
    };
    fixture.componentRef.setInput('events', [
      timedEvent,
      {
        ...timedEvent,
        id: 'event-2',
        title: 'OOO',
        isAllDay: true,
        meetUrl: undefined,
      },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.eventTime({ ...timedEvent, isAllDay: true })).toBe(
      'Todo el dia',
    );
    expect(fixture.componentInstance.eventTime(timedEvent)).toMatch(/\d{2}:\d{2}/);
    expect(fixture.nativeElement.textContent).toContain('Meet');
  });

  it('renders Slack mentions and toggles open state', async () => {
    await TestBed.configureTestingModule({
      imports: [SlackSectionComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(SlackSectionComponent);
    fixture.componentRef.setInput('mentions', [
      {
        ts: '123.000',
        channelName: 'daily',
        senderName: 'Javier',
        text: 'Revisar dashboard',
        permalink: 'https://slack.example.com/message',
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('#daily');
    fixture.componentInstance.toggleOpen();

    expect(fixture.componentInstance.open()).toBe(false);
  });
});
