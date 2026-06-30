import { format, subDays, addDays } from 'date-fns';
import { getEffectivePriority } from './reminder-priority.util';

const toDate = (date: Date): string => format(date, 'yyyy-MM-dd');

describe('getEffectivePriority', () => {
  it('keeps low priority after 1 pending day', () => {
    expect(getEffectivePriority('low', toDate(subDays(new Date(), 1)))).toBe('low');
  });

  it('escalates low priority to medium after 2 pending days', () => {
    expect(getEffectivePriority('low', toDate(subDays(new Date(), 2)))).toBe('medium');
  });

  it('escalates low priority to high after 5 pending days', () => {
    expect(getEffectivePriority('low', toDate(subDays(new Date(), 5)))).toBe('high');
  });

  it('escalates medium priority to high after 3 pending days', () => {
    expect(getEffectivePriority('medium', toDate(subDays(new Date(), 3)))).toBe('high');
  });

  it('keeps high priority as high', () => {
    expect(getEffectivePriority('high', toDate(subDays(new Date(), 10)))).toBe('high');
  });

  it('keeps original priority for future dates', () => {
    expect(getEffectivePriority('medium', toDate(addDays(new Date(), 1)))).toBe('medium');
  });
});
