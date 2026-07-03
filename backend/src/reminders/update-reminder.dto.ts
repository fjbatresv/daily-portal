import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Priority } from '../common/types/daily-digest.types';

const priorities = ['low', 'medium', 'high'] as const;

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
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @IsEnum(priorities)
  priority?: Priority;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
