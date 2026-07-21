import { DailyDigest } from '../common/types/daily-digest.types';
import { DailyAggregatorService } from './daily-aggregator.service';
import { DashboardController } from './dashboard.controller';

const digest: DailyDigest = {
  date: '2026-06-29',
  generatedAt: '2026-06-29T14:00:00.000Z',
  todoList: [],
  tasks: [],
  prs: [],
  events: [],
  slackMentions: [],
  reminders: [],
};

describe('DashboardController', () => {
  let aggregator: jest.Mocked<DailyAggregatorService>;
  let controller: DashboardController;

  beforeEach(() => {
    aggregator = {
      buildDailyDigest: jest.fn<Promise<DailyDigest>, []>().mockResolvedValue(digest),
      invalidateCache: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DailyAggregatorService>;
    controller = new DashboardController(aggregator);
  });

  it('returns health status with timestamp and uptime', () => {
    const health = controller.getHealth();

    expect(health.status).toBe('ok');
    expect(typeof health.timestamp).toBe('string');
    expect(typeof health.uptime).toBe('number');
  });

  it('returns the current digest', async () => {
    await expect(controller.getDailyDigest()).resolves.toBe(digest);
  });

  it('invalidates cache before returning a refreshed digest', async () => {
    await expect(controller.refreshDailyDigest()).resolves.toBe(digest);

    expect(aggregator.invalidateCache.mock.calls).toHaveLength(1);
    expect(aggregator.buildDailyDigest.mock.calls).toHaveLength(1);
  });
});
