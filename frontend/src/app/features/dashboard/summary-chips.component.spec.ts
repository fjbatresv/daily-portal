import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DailyDigest } from '../../core/models/daily-digest.model';
import { SummaryChipsComponent } from './summary-chips.component';

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

describe('SummaryChipsComponent', () => {
  let fixture: ComponentFixture<SummaryChipsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SummaryChipsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SummaryChipsComponent);
  });

  it('counts urgent pull requests and renders non-empty source chips', () => {
    fixture.componentRef.setInput(
      'digest',
      digest({
        tasks: [
          {
            id: 'jira-1',
            key: 'TEMP-1',
            summary: 'Implementar',
            status: 'In Progress',
            priority: 'High',
            url: 'https://jira.example.com/TEMP-1',
          },
        ],
        prs: [
          {
            id: 1,
            title: 'PR con conflicto',
            url: 'https://github.example.com/pr/1',
            repo: 'daily-portal',
            status: 'open',
            isDraft: false,
            hasNewComments: false,
            checkStatus: 'success',
            hasConflicts: true,
            updatedAt: '2026-07-24T12:00:00.000Z',
          },
          {
            id: 2,
            title: 'PR normal',
            url: 'https://github.example.com/pr/2',
            repo: 'daily-portal',
            status: 'open',
            isDraft: false,
            hasNewComments: false,
            checkStatus: 'success',
            hasConflicts: false,
            updatedAt: '2026-07-24T12:00:00.000Z',
          },
        ],
        events: [
          {
            id: 'event-1',
            title: 'Standup',
            startTime: '2026-07-24T14:00:00.000Z',
            endTime: '2026-07-24T14:30:00.000Z',
            calendarId: 'primary',
            calendarName: 'Primary',
            isAllDay: false,
          },
        ],
        slackMentions: [
          {
            ts: '123.000',
            channelName: 'daily',
            senderName: 'Javier',
            text: 'Revisar',
            permalink: 'https://slack.example.com/message',
          },
        ],
      }),
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.urgentCount()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('1 urgentes');
    expect(fixture.nativeElement.textContent).toContain('1 tareas');
    expect(fixture.nativeElement.textContent).toContain('1 eventos');
    expect(fixture.nativeElement.textContent).toContain('1 menciones');
  });

  it('hides optional chips when every count is empty', () => {
    fixture.componentRef.setInput('digest', digest());
    fixture.detectChanges();

    expect(fixture.componentInstance.urgentCount()).toBe(0);
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
