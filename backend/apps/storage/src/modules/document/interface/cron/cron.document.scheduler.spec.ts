import { DatabaseRunnerService } from '@backend/common';
import { Config } from '@/config';
import { DocumentSweepPreviewsUseCase } from '@modules/document/application/use-cases/document.sweep-previews.use-case';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronDocumentScheduler } from './cron.document.scheduler';

const NOW = new Date('2026-01-01T12:00:00Z');
const MINUTE = 60_000;

describe('CronDocumentScheduler', () => {
  let useCase: { execute: jest.Mock };
  let runner: { isolatedRun: jest.Mock };

  const create = (budgetMinutes: number) =>
    new CronDocumentScheduler(
      useCase as unknown as DocumentSweepPreviewsUseCase,
      runner as unknown as DatabaseRunnerService,
      { getOrThrow: () => ({ budgetMinutes }) } as unknown as ConfigService<Config>,
    );

  // A batch that takes this long and answers this cursor.
  const batch = (minutes: number, cursor?: string) => () => {
    jest.setSystemTime(Date.now() + minutes * MINUTE);
    return Promise.resolve(cursor);
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    useCase = { execute: jest.fn().mockResolvedValue(undefined) };
    runner = { isolatedRun: jest.fn((work: () => Promise<unknown>) => work()) };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('takes batch after batch from where the last one ended, each in a context of its own', async () => {
    useCase.execute
      .mockImplementationOnce(batch(1, 'file-2'))
      .mockImplementationOnce(batch(1, 'file-4'))
      .mockImplementationOnce(batch(1));

    await create(8).sweepPreviews();

    expect(useCase.execute.mock.calls).toEqual([[undefined], ['file-2'], ['file-4']]);
    expect(runner.isolatedRun).toHaveBeenCalledTimes(3);
  });

  it('takes no further batch once the budget is spent', async () => {
    useCase.execute.mockImplementation(batch(3, 'file-2'));

    await create(8).sweepPreviews();

    expect(useCase.execute).toHaveBeenCalledTimes(3);
  });

  it('takes one batch on a budget of 0', async () => {
    useCase.execute.mockImplementation(batch(0, 'file-2'));

    await create(0).sweepPreviews();

    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });

  it('skips a tick while the previous sweep is still running', async () => {
    const scheduler = create(8);
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
    const scheduler = create(8);
    useCase.execute.mockRejectedValueOnce(new Error('db down'));

    await scheduler.sweepPreviews();
    await scheduler.sweepPreviews();

    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });
});
