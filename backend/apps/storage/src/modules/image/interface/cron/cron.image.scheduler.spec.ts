import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { DatabaseRunnerService } from '@backend/common';
import { Config } from '@/config';
import { ImageSweepPreviewsUseCase } from '@modules/image/application/use-cases/image.sweep-previews.use-case';
import { ConfigService } from '@nestjs/config';
import { CronImageScheduler } from './cron.image.scheduler';

// How a sweep is run is specced once, on `PreviewSweepScheduler`; here, what this one runs.
describe('CronImageScheduler', () => {
  let useCase: { execute: Mock };
  let runner: { isolatedRun: Mock };
  let configService: { getOrThrow: Mock };
  let scheduler: CronImageScheduler;

  beforeEach(() => {
    useCase = { execute: vi.fn().mockResolvedValue(undefined) };
    runner = { isolatedRun: vi.fn((work: () => Promise<unknown>) => work()) };
    configService = { getOrThrow: vi.fn().mockReturnValue({ budgetMinutes: 8 }) };

    scheduler = new CronImageScheduler(
      useCase as unknown as ImageSweepPreviewsUseCase,
      runner as unknown as DatabaseRunnerService,
      configService as unknown as ConfigService<Config>,
    );
  });

  it('takes its budget from the image sweep settings', () => {
    expect(configService.getOrThrow).toHaveBeenCalledWith('imagePreviewSweep', { infer: true });
  });

  it('runs the image sweep', async () => {
    await scheduler.sweepPreviews();

    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });
});
