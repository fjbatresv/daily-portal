import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateReminderDto } from './create-reminder.dto';
import { ReminderResponse } from './reminder-response.types';
import { RemindersService } from './reminders.service';
import { UpdateReminderDto } from './update-reminder.dto';

/**
 * Exposes HTTP endpoints for managing personal reminders.
 */
@Controller('api/reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  /**
   * Lists reminders for today, a given date, or all persisted rows.
   */
  @Get()
  listReminders(@Query('date') date?: string, @Query('all') all?: string): ReminderResponse[] {
    return this.reminders.listReminders(date, all === 'true');
  }

  /**
   * Creates a new reminder.
   */
  @Post()
  create(@Body() dto: CreateReminderDto): ReminderResponse {
    return this.reminders.create(dto);
  }

  /**
   * Reads a reminder by id.
   */
  @Get(':id')
  getById(@Param('id') id: string): ReminderResponse {
    return this.reminders.getById(id);
  }

  /**
   * Updates a reminder by id.
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReminderDto): ReminderResponse {
    return this.reminders.update(id, dto);
  }

  /**
   * Marks a reminder as completed.
   */
  @Patch(':id/complete')
  complete(@Param('id') id: string): ReminderResponse {
    return this.reminders.complete(id);
  }

  /**
   * Deletes a reminder by id.
   */
  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string): void {
    this.reminders.delete(id);
  }
}
