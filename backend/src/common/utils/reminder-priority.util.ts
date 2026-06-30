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
  const escalatedRank =
    priority === 'low' && daysPending >= 5
      ? 2
      : priority === 'low' && daysPending >= 2
        ? 1
        : priority === 'medium' && daysPending >= 3
          ? 2
          : priorityRank[priority];

  return priorities[Math.max(priorityRank[priority], escalatedRank)];
}
