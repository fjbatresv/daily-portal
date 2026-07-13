import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { priorities, Priority } from '../common/types/daily-digest.types';

/**
 * Payload required to create a reminder.
 */
export class CreateReminderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;

  @IsDateString({ strict: true })
  date!: string;

  @IsOptional()
  @IsEnum(priorities)
  priority?: Priority = 'medium';
}
