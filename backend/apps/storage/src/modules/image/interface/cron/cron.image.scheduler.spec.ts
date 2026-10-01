import { DatabaseRunnerService } from '@backend/common';
import { Config } from '@/config';
import { ImageSweepPreviewsUseCase } from '@modules/image/application/use-cases/image.sweep-previews.use-case';
import { ConfigService } from '@nestjs/config';
import { CronImageScheduler } from './cron.image.scheduler';

// How a sweep is run is specced once, on `PreviewSweepScheduler`; here, what this one runs.
describe('CronImageScheduler', () => {
  let useCase: { execute: jest.Mock };
  let runner: { isolatedRun: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let scheduler: CronImageScheduler;

  beforeEach(() => {
    useCase = { execute: jest.fn().mockResolvedValue(undefined) };
    runner = { isolatedRun: jest.fn((work: () => Promise<unknown>) => work()) };
    configService = { getOrThrow: jest.fn().mockReturnValue({ budgetMinutes: 8 }) };

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
