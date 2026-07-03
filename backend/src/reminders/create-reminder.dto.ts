import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Priority } from '../common/types/daily-digest.types';

const priorities = ['low', 'medium', 'high'] as const;

/**
 * Payload required to create a reminder.
 */
export class CreateReminderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsOptional()
  @IsEnum(priorities)
  priority?: Priority = 'medium';
}
