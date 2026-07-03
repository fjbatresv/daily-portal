import { Injectable, NotFoundException } from '@nestjs/common';
import { format } from 'date-fns';
import { Reminder } from '../common/types/daily-digest.types';
import { getDaysPending, getEffectivePriority } from '../common/utils/reminder-priority.util';
import { CreateReminderDto } from './create-reminder.dto';
import { ReminderResponse } from './reminder-response.types';
import { ReminderRow, RemindersRepository } from './reminders.repository';
import { UpdateReminderDto } from './update-reminder.dto';

/**
 * Provides reminder CRUD behavior and computed display metadata.
 */
@Injectable()
export class RemindersService {
  constructor(private readonly repository: RemindersRepository) {}

  /**
   * Returns today's uncompleted reminders for digest generation.
   */
  getTodayReminders(): ReminderResponse[] {
    return this.repository.findByDate(this.today()).map((row) => this.mapRow(row));
  }

  /**
   * Lists reminders using either all rows, an explicit date, or today's date.
   */
  listReminders(date?: string, all = false): ReminderResponse[] {
    const rows = all ? this.repository.findAll() : this.repository.findByDate(date ?? this.today());
    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Returns one reminder or raises a 404 when it does not exist.
   */
  getById(id: string): ReminderResponse {
    const row = this.repository.findById(id);
    if (!row) {
      throw new NotFoundException(`Reminder not found: ${id}`);
    }

    return this.mapRow(row);
  }

  /**
   * Creates a reminder with default medium priority when omitted.
   */
  create(dto: CreateReminderDto): ReminderResponse {
    return this.mapRow(this.repository.create(dto));
  }

  /**
   * Updates an existing reminder.
   */
  update(id: string, dto: UpdateReminderDto): ReminderResponse {
    this.assertExists(id);
    const row = this.repository.update(id, dto);
    if (!row) {
      throw new NotFoundException(`Reminder not found: ${id}`);
    }

    return this.mapRow(row);
  }

  /**
   * Marks an existing reminder as completed.
   */
  complete(id: string): ReminderResponse {
    const row = this.repository.complete(id);
    if (!row) {
      throw new NotFoundException(`Reminder not found: ${id}`);
    }

    return this.mapRow(row);
  }

  /**
   * Deletes an existing reminder.
   */
  delete(id: string): void {
    if (!this.repository.delete(id)) {
      throw new NotFoundException(`Reminder not found: ${id}`);
    }
  }

  private assertExists(id: string): void {
    if (!this.repository.findById(id)) {
      throw new NotFoundException(`Reminder not found: ${id}`);
    }
  }

  private mapRow(row: ReminderRow): ReminderResponse {
    const reminder: Reminder = {
      id: row.id,
      text: row.text,
      date: row.date,
      priority: row.priority,
      completed: row.completed === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return {
      ...reminder,
      daysOverdue: getDaysPending(reminder.date),
      escalatedPriority: getEffectivePriority(reminder.priority, reminder.date),
    };
  }

  private today(): string {
    return format(new Date(), 'yyyy-MM-dd');
  }
}
