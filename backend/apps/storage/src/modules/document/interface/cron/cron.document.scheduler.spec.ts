import { DatabaseRunnerService } from '@backend/common';
import { DocumentSweepPreviewsUseCase } from '@modules/document/application/use-cases/document.sweep-previews.use-case';
import { Logger } from '@nestjs/common';
import { CronDocumentScheduler } from './cron.document.scheduler';

describe('CronDocumentScheduler', () => {
  let useCase: { execute: jest.Mock };
  let scheduler: CronDocumentScheduler;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    useCase = { execute: jest.fn().mockResolvedValue(undefined) };
    scheduler = new CronDocumentScheduler(
      useCase as unknown as DocumentSweepPreviewsUseCase,
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
