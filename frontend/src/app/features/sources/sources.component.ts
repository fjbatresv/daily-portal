import { Component, input } from '@angular/core';
import { DailyDigest } from '../../core/models/daily-digest.model';
import { CalendarSectionComponent } from './calendar-section.component';
import { GitHubSectionComponent } from './github-section.component';
import { JiraSectionComponent } from './jira-section.component';
import { RemindersSectionComponent } from './reminders-section/reminders-section.component';
import { SlackSectionComponent } from './slack-section.component';

/**
 * Hosts the detailed source views for every integration in the digest.
 */
@Component({
  selector: 'app-sources',
  imports: [
    JiraSectionComponent,
    GitHubSectionComponent,
    CalendarSectionComponent,
    SlackSectionComponent,
    RemindersSectionComponent,
  ],
  template: `
    <div class="space-y-4">
      <app-jira-section [tasks]="digest().tasks" />
      <app-github-section [prs]="digest().prs" />
      <app-calendar-section [events]="digest().events" />
      <app-slack-section [mentions]="digest().slackMentions" />
      <app-reminders-section [reminders]="digest().reminders" />
    </div>
  `,
})
export class SourcesComponent {
  readonly digest = input.required<DailyDigest>();
}
