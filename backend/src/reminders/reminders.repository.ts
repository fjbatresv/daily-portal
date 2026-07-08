import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database';
import { Priority } from '../common/types/daily-digest.types';
import { CreateReminderDto } from './create-reminder.dto';
import { UpdateReminderDto } from './update-reminder.dto';

export interface ReminderRow {
  id: string;
  text: string;
  date: string;
  priority: Priority;
  completed: 0 | 1;
  created_at: string;
  updated_at: string;
}

type ReminderUpdateValue = string | 0 | 1;
type ReminderUpdateEntry = readonly [
  keyof Pick<ReminderRow, 'text' | 'date' | 'priority' | 'completed'>,
  ReminderUpdateValue,
];

/**
 * Encapsulates all SQLite queries for persisted reminders.
 */
@Injectable()
export class RemindersRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Finds uncompleted reminders for a specific date.
   */
  findByDate(date: string): ReminderRow[] {
    return this.db.instance
      .prepare(
        `SELECT * FROM reminders
         WHERE date = ? AND completed = 0
         ORDER BY priority DESC, created_at ASC`,
      )
      .all(date) as ReminderRow[];
  }

  /**
   * Lists all reminders, including completed ones.
   */
  findAll(): ReminderRow[] {
    return this.db.instance
      .prepare('SELECT * FROM reminders ORDER BY date DESC, created_at DESC')
      .all() as ReminderRow[];
  }

  /**
   * Finds one reminder by id.
   */
  findById(id: string): ReminderRow | undefined {
    return this.db.instance.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as
      ReminderRow | undefined;
  }

  /**
   * Inserts a reminder and returns the stored row.
   */
  create(dto: CreateReminderDto): ReminderRow {
    return this.db.instance
      .prepare('INSERT INTO reminders (text, date, priority) VALUES (?, ?, ?) RETURNING *')
      .get(dto.text, dto.date, dto.priority ?? 'medium') as ReminderRow;
  }

  /**
   * Updates a reminder partially and returns the updated row.
   */
  update(id: string, dto: UpdateReminderDto): ReminderRow | undefined {
    const entries: ReminderUpdateEntry[] = [];

    if (dto.text !== undefined) entries.push(['text', dto.text]);
    if (dto.date !== undefined) entries.push(['date', dto.date]);
    if (dto.priority !== undefined) entries.push(['priority', dto.priority]);
    if (dto.completed !== undefined) entries.push(['completed', dto.completed ? 1 : 0]);

    if (entries.length === 0) {
      return this.findById(id);
    }

    const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
    const values = entries.map(([, value]) => value);

    return this.db.instance
      .prepare(
        `UPDATE reminders
         SET ${assignments}, updated_at = datetime('now')
         WHERE id = ?
         RETURNING *`,
      )
      .get(...values, id) as ReminderRow | undefined;
  }

  /**
   * Marks a reminder as completed.
   */
  complete(id: string): ReminderRow | undefined {
    return this.db.instance
      .prepare(
        `UPDATE reminders
         SET completed = 1, updated_at = datetime('now')
         WHERE id = ?
         RETURNING *`,
      )
      .get(id) as ReminderRow | undefined;
  }

  /**
   * Deletes a reminder and reports whether a row existed.
   */
  delete(id: string): boolean {
    return this.db.instance.prepare('DELETE FROM reminders WHERE id = ?').run(id).changes > 0;
  }
}
