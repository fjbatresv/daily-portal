import { differenceInCalendarDays, parseISO, startOfToday } from 'date-fns';
import { Priority } from '../types/daily-digest.types';

const priorityRank: Record<Priority, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const priorities: Priority[] = ['low', 'medium', 'high'];

export function getDaysPending(date: string): number {
  const days = differenceInCalendarDays(startOfToday(), parseISO(date));
  return Math.max(days, 0);
}

export function getEffectivePriority(priority: Priority, date: string): Priority {
  const daysPending = getDaysPending(date);
  let escalatedRank = priorityRank[priority];

  if (priority === 'low' && daysPending >= 5) {
    escalatedRank = 2;
  } else if (priority === 'low' && daysPending >= 2) {
    escalatedRank = 1;
  } else if (priority === 'medium' && daysPending >= 3) {
    escalatedRank = 2;
  }

  return priorities[Math.max(priorityRank[priority], escalatedRank)];
}
