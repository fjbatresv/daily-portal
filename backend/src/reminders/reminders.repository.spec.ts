import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from '../common/database';
import { RemindersRepository } from './reminders.repository';

describe('RemindersRepository', () => {
  let tempDir: string;
  let db: Database.Database;
  let repository: RemindersRepository;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'daily-portal-reminders-'));
    db = new Database(join(tempDir, 'portal.db'));
    db.exec(readFileSync(join(process.cwd(), '../db/schema.sql'), 'utf8'));
    repository = new RemindersRepository({ instance: db } as DatabaseService);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates, reads, and lists reminders by date', () => {
    const reminder = repository.create({ text: 'Send note', date: '2026-06-30', priority: 'high' });

    expect(repository.findById(reminder.id)).toMatchObject({ text: 'Send note' });
    expect(repository.findByDate('2026-06-30')).toHaveLength(1);
    expect(repository.findAll()).toHaveLength(1);
  });

  it('orders reminders by priority rank before creation time', () => {
    repository.create({ text: 'Low note', date: '2026-06-30', priority: 'low' });
    repository.create({ text: 'High note', date: '2026-06-30', priority: 'high' });
    repository.create({ text: 'Medium note', date: '2026-06-30', priority: 'medium' });

    expect(repository.findByDate('2026-06-30').map((reminder) => reminder.priority)).toEqual([
      'high',
      'medium',
      'low',
    ]);
  });

  it('updates each supported field', () => {
    const reminder = repository.create({ text: 'Send note', date: '2026-06-30' });

    const updated = repository.update(reminder.id, {
      text: 'Updated note',
      date: '2026-07-01',
      priority: 'low',
      completed: true,
    });

    expect(updated).toMatchObject({
      text: 'Updated note',
      date: '2026-07-01',
      priority: 'low',
      completed: 1,
    });
  });

  it('returns the existing row when update has no fields', () => {
    const reminder = repository.create({ text: 'Send note', date: '2026-06-30' });

    expect(repository.update(reminder.id, {})).toMatchObject({ id: reminder.id });
  });

  it('returns undefined when updating a missing row', () => {
    expect(repository.update('missing', { text: 'Updated' })).toBeUndefined();
  });

  it('completes and deletes reminders', () => {
    const reminder = repository.create({ text: 'Send note', date: '2026-06-30' });

    expect(repository.complete(reminder.id)).toMatchObject({ completed: 1 });
    expect(repository.findByDate('2026-06-30')).toHaveLength(0);
    expect(repository.delete(reminder.id)).toBe(true);
    expect(repository.delete(reminder.id)).toBe(false);
  });

  it('returns undefined when completing a missing row', () => {
    expect(repository.complete('missing')).toBeUndefined();
  });
});
