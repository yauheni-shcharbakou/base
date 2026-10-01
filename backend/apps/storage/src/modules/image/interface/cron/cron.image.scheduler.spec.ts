import { DatabaseRunnerService } from '@backend/common';
import { ImageSweepPreviewsUseCase } from '@modules/image/application/use-cases/image.sweep-previews.use-case';
import { Logger } from '@nestjs/common';
import { CronImageScheduler } from './cron.image.scheduler';

describe('CronImageScheduler', () => {
  let useCase: { execute: jest.Mock };
  let scheduler: CronImageScheduler;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    useCase = { execute: jest.fn().mockResolvedValue(undefined) };
    scheduler = new CronImageScheduler(
      useCase as unknown as ImageSweepPreviewsUseCase,
      { isolatedRun: (work: () => Promise<void>) => work() } as unknown as DatabaseRunnerService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips a tick while the previous sweep is still running', async () => {
    let finish: () => void;
    useCase.execute.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));

    const first = scheduler.sweepPreviews();
    await scheduler.sweepPreviews();

    expect(useCase.execute).toHaveBeenCalledTimes(1);

    finish();
    await first;
    await scheduler.sweepPreviews();

    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });

  it('sweeps again after a sweep that failed', async () => {
    useCase.execute.mockRejectedValueOnce(new Error('db down'));

    await scheduler.sweepPreviews();
    await scheduler.sweepPreviews();

    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });
});
