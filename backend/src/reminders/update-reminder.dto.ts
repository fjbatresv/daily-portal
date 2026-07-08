import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { priorities, Priority } from '../common/types/daily-digest.types';

/**
 * Partial payload used to update a persisted reminder.
 */
export class UpdateReminderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  date?: string;

  @IsOptional()
  @IsEnum(priorities)
  priority?: Priority;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
