import { InjectionToken } from '@nestjs/common';
import { DailyDigest } from '../common/types/daily-digest.types';

export interface DailyDigestBuilder {
  buildDailyDigest(): Promise<DailyDigest>;
}

export const DAILY_DIGEST_BUILDER: InjectionToken = Symbol('DAILY_DIGEST_BUILDER');
