import { Test } from '@nestjs/testing';
import { validate } from 'class-validator';
import { CreateReminderDto } from './create-reminder.dto';
import { ReminderResponse } from './reminder-response.types';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { UpdateReminderDto } from './update-reminder.dto';

const reminder: ReminderResponse = {
  id: 'reminder-1',
  text: 'Follow up',
  date: '2026-06-30',
  priority: 'medium',
  completed: false,
  createdAt: '2026-06-29 08:00:00',
  updatedAt: '2026-06-29 08:00:00',
  daysOverdue: 0,
  escalatedPriority: 'medium',
};

describe('RemindersController', () => {
  let controller: RemindersController;
  let service: jest.Mocked<RemindersService>;

  beforeEach(async () => {
    service = {
      listReminders: jest.fn(),
      create: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      complete: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<RemindersService>;

    const moduleRef = await Test.createTestingModule({
      controllers: [RemindersController],
      providers: [{ provide: RemindersService, useValue: service }],
    }).compile();

    controller = moduleRef.get(RemindersController);
  });

  it('passes query parameters to the service', () => {
    service.listReminders.mockReturnValue([reminder]);

    expect(controller.listReminders('2026-06-30', 'true')).toEqual([reminder]);
    expect(service.listReminders.mock.calls).toEqual([['2026-06-30', true]]);
  });

  it('creates reminders', () => {
    service.create.mockReturnValue(reminder);

    expect(controller.create({ text: 'Follow up', date: '2026-06-30' })).toBe(reminder);
  });

  it('returns reminders by id', () => {
    service.getById.mockReturnValue(reminder);

    expect(controller.getById('reminder-1')).toBe(reminder);
  });

  it('updates reminders by id', () => {
    service.update.mockReturnValue(reminder);

    expect(controller.update('reminder-1', { completed: true })).toBe(reminder);
  });

  it('completes reminders by id', () => {
    service.complete.mockReturnValue(reminder);

    expect(controller.complete('reminder-1')).toBe(reminder);
  });

  it('deletes reminders by id', () => {
    expect(controller.delete('reminder-1')).toBeUndefined();
    expect(service.delete.mock.calls).toEqual([['reminder-1']]);
  });

  it('rejects invalid create DTO values', async () => {
    const dto = new CreateReminderDto();
    dto.text = '';
    dto.date = '06/30/2026';

    const errors = await validate(dto);
    expect(errors).toHaveLength(2);
  });

  it('rejects impossible calendar dates in reminder DTOs', async () => {
    const createDto = new CreateReminderDto();
    createDto.text = 'Follow up';
    createDto.date = '2026-02-30';

    const updateDto = new UpdateReminderDto();
    updateDto.date = '2026-02-30';

    await expect(validate(createDto)).resolves.toHaveLength(1);
    await expect(validate(updateDto)).resolves.toHaveLength(1);
  });

  it('rejects full ISO timestamps for date-only reminder fields', async () => {
    const createDto = new CreateReminderDto();
    createDto.text = 'Follow up';
    createDto.date = '2026-06-30T00:00:00.000Z';

    const updateDto = new UpdateReminderDto();
    updateDto.date = '2026-06-30T00:00:00.000Z';

    await expect(validate(createDto)).resolves.toHaveLength(1);
    await expect(validate(updateDto)).resolves.toHaveLength(1);
  });
});
