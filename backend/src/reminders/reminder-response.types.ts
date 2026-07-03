import { Priority, Reminder } from '../common/types/daily-digest.types';

export type ReminderResponse = Reminder & {
  daysOverdue: number;
  escalatedPriority: Priority;
};
