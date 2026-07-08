import { NotFoundException } from '@nestjs/common';
import { addDays, format, subDays } from 'date-fns';
import { RemindersRepository, ReminderRow } from './reminders.repository';
import { RemindersService } from './reminders.service';

const dateString = (date: Date): string => format(date, 'yyyy-MM-dd');

function row(overrides: Partial<ReminderRow> = {}): ReminderRow {
  return {
    id: 'reminder-1',
    text: 'Follow up',
    date: dateString(new Date()),
    priority: 'medium',
    completed: 0,
    created_at: '2026-06-29 08:00:00',
    updated_at: '2026-06-29 08:00:00',
    ...overrides,
  };
}

describe('RemindersService', () => {
  let repository: jest.Mocked<RemindersRepository>;
  let service: RemindersService;

  beforeEach(() => {
    repository = {
      findByDate: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      complete: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<RemindersRepository>;
    service = new RemindersService(repository);
  });

  it('returns today reminders with computed escalation fields', () => {
    repository.findByDate.mockReturnValue([row({ date: dateString(subDays(new Date(), 3)) })]);

    const reminders = service.getTodayReminders();

    expect(repository.findByDate.mock.calls).toEqual([[dateString(new Date())]]);
    expect(reminders[0]).toMatchObject({
      id: 'reminder-1',
      completed: false,
      daysOverdue: 3,
      escalatedPriority: 'high',
      updatedAt: '2026-06-29 08:00:00',
    });
  });

  it('lists all reminders when all is true', () => {
    repository.findAll.mockReturnValue([row({ completed: 1 })]);

    expect(service.listReminders(undefined, true)).toHaveLength(1);
    expect(repository.findAll.mock.calls).toHaveLength(1);
  });

  it('lists reminders for an explicit date', () => {
    repository.findByDate.mockReturnValue([row({ date: '2026-06-30' })]);

    expect(service.listReminders('2026-06-30')).toHaveLength(1);
    expect(repository.findByDate.mock.calls).toEqual([['2026-06-30']]);
  });

  it('returns reminders by id', () => {
    repository.findById.mockReturnValue(row());

    expect(service.getById('reminder-1')).toMatchObject({ id: 'reminder-1' });
  });

  it('throws NotFoundException when reading a missing reminder', () => {
    repository.findById.mockReturnValue(undefined);

    expect(() => service.getById('missing')).toThrow(NotFoundException);
  });

  it('creates reminders through the repository', () => {
    repository.create.mockReturnValue(row({ priority: 'low' }));

    expect(
      service.create({
        text: 'Send note',
        date: dateString(addDays(new Date(), 1)),
        priority: 'low',
      }),
    ).toMatchObject({ text: 'Follow up', priority: 'low', escalatedPriority: 'low' });
  });

  it('throws NotFoundException when updating a missing reminder', () => {
    repository.update.mockReturnValue(undefined);

    expect(() => service.update('missing', { text: 'Updated' })).toThrow(NotFoundException);
  });

  it('updates existing reminders', () => {
    repository.update.mockReturnValue(row({ text: 'Updated' }));

    expect(service.update('reminder-1', { text: 'Updated' })).toMatchObject({ text: 'Updated' });
  });

  it('throws NotFoundException when repository update returns undefined', () => {
    repository.update.mockReturnValue(undefined);

    expect(() => service.update('reminder-1', { text: 'Updated' })).toThrow(NotFoundException);
  });

  it('marks reminders as completed', () => {
    repository.complete.mockReturnValue(row({ completed: 1 }));

    expect(service.complete('reminder-1').completed).toBe(true);
  });

  it('throws NotFoundException when completing a missing reminder', () => {
    repository.complete.mockReturnValue(undefined);

    expect(() => service.complete('missing')).toThrow(NotFoundException);
  });

  it('throws NotFoundException when deleting a missing reminder', () => {
    repository.delete.mockReturnValue(false);

    expect(() => service.delete('missing')).toThrow(NotFoundException);
  });

  it('deletes existing reminders without returning a value', () => {
    repository.delete.mockReturnValue(true);

    expect(service.delete('reminder-1')).toBeUndefined();
  });
});
