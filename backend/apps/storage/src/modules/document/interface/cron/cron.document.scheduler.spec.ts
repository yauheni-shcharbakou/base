import { DatabaseRunnerService } from '@backend/common';
import { Config } from '@/config';
import { DocumentSweepPreviewsUseCase } from '@modules/document/application/use-cases/document.sweep-previews.use-case';
import { ConfigService } from '@nestjs/config';
import { CronDocumentScheduler } from './cron.document.scheduler';

// How a sweep is run is specced once, on `PreviewSweepScheduler`; here, what this one runs.
describe('CronDocumentScheduler', () => {
  let useCase: { execute: jest.Mock };
  let runner: { isolatedRun: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let scheduler: CronDocumentScheduler;

  beforeEach(() => {
    useCase = { execute: jest.fn().mockResolvedValue(undefined) };
    runner = { isolatedRun: jest.fn((work: () => Promise<unknown>) => work()) };
    configService = { getOrThrow: jest.fn().mockReturnValue({ budgetMinutes: 8 }) };

    scheduler = new CronDocumentScheduler(
      useCase as unknown as DocumentSweepPreviewsUseCase,
      runner as unknown as DatabaseRunnerService,
      configService as unknown as ConfigService<Config>,
    );
  });

  it('takes its budget from the document sweep settings', () => {
    expect(configService.getOrThrow).toHaveBeenCalledWith('documentPreviewSweep', { infer: true });
  });

  it('runs the document sweep', async () => {
    await scheduler.sweepPreviews();

    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });
});
