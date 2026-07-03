import { DailyDigest } from '../common/types/daily-digest.types';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

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

describe('SchedulerController', () => {
  it('delegates manual trigger requests to the scheduler service', async () => {
    const scheduler = {
      triggerManual: jest.fn<Promise<DailyDigest>, []>().mockResolvedValue(digest),
    } as unknown as SchedulerService;
    const controller = new SchedulerController(scheduler);

    await expect(controller.triggerManual()).resolves.toBe(digest);
  });
});
