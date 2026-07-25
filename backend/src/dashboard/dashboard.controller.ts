import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { DailyDigest } from '../common/types/daily-digest.types';
import { DailyAggregatorService } from './daily-aggregator.service';

/**
 * Public liveness payload returned by the health endpoint.
 */
export interface HealthResponse {
  /**
   * Fixed marker that indicates the API process is accepting requests.
   */
  status: 'ok';

  /**
   * ISO timestamp generated when the health probe is handled.
   */
  timestamp: string;

  /**
   * Process uptime in seconds, as reported by Node.js.
   */
  uptime: number;
}

/**
 * Exposes dashboard aggregation endpoints and the application health check.
 */
@Controller('api')
export class DashboardController {
  constructor(private readonly aggregator: DailyAggregatorService) {}

  /**
   * Reports process liveness for Docker and external health probes.
   */
  @Get('health')
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Returns the current daily digest using cached integration data when available.
   */
  @Get('dashboard')
  getDailyDigest(): Promise<DailyDigest> {
    return this.aggregator.buildDailyDigest();
  }

  /**
   * Invalidates integration cache and returns a freshly calculated digest.
   */
  @Post('dashboard/refresh')
  @HttpCode(200)
  async refreshDailyDigest(): Promise<DailyDigest> {
    await this.aggregator.invalidateCache();
    return this.aggregator.buildDailyDigest();
  }
}
