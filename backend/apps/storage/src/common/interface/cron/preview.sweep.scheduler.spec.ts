import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { DatabaseRunnerService } from '@backend/common';
import { PreviewSweepUseCase } from '@common/application/use-cases/preview.sweep.use-case';
import { Logger } from '@nestjs/common';
import { PreviewSweepScheduler } from './preview.sweep.scheduler';

const NOW = new Date('2026-01-01T12:00:00Z');
const MINUTE = 60_000;

describe('PreviewSweepScheduler', () => {
  let useCase: { execute: Mock };
  let runner: { isolatedRun: Mock };

  class SweepScheduler extends PreviewSweepScheduler {
    constructor(budgetMinutes: number) {
      super(
        'Row',
        budgetMinutes,
        useCase as unknown as PreviewSweepUseCase<{ id: string }>,
        runner,
      );
    }

    tick() {
      return this.sweep();
    }
  }

  const create = (budgetMinutes: number) => new SweepScheduler(budgetMinutes);

  // A batch that takes this long and answers this cursor.
  const batch = (minutes: number, cursor?: string) => () => {
    vi.setSystemTime(Date.now() + minutes * MINUTE);
    return Promise.resolve(cursor);
  };

  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(NOW);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    useCase = { execute: vi.fn().mockResolvedValue(undefined) };
    runner = { isolatedRun: vi.fn((work: () => Promise<unknown>) => work()) };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('takes batch after batch from where the last one ended, each in a context of its own', async () => {
    useCase.execute
      .mockImplementationOnce(batch(1, 'row-2'))
      .mockImplementationOnce(batch(1, 'row-4'))
      .mockImplementationOnce(batch(1));

    await create(8).tick();

    expect(useCase.execute.mock.calls).toEqual([[undefined], ['row-2'], ['row-4']]);
    expect(runner.isolatedRun).toHaveBeenCalledTimes(3);
  });

  it('takes no further batch once the budget is spent', async () => {
    useCase.execute.mockImplementation(batch(3, 'row-2'));

    await create(8).tick();

    expect(useCase.execute).toHaveBeenCalledTimes(3);
  });

  it('takes one batch on a budget of 0', async () => {
    useCase.execute.mockImplementation(batch(0, 'row-2'));

    await create(0).tick();

    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });

  it('skips a tick while the previous sweep is still running', async () => {
    const scheduler = create(8);
    let finish: () => void;
    useCase.execute.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));

    const first = scheduler.tick();
    await scheduler.tick();

    expect(useCase.execute).toHaveBeenCalledTimes(1);

    finish();
    await first;
    await scheduler.tick();

    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });

  it('sweeps again after a sweep that failed', async () => {
    const scheduler = create(8);
    useCase.execute.mockRejectedValueOnce(new Error('db down'));

    await scheduler.tick();
    await scheduler.tick();

    expect(useCase.execute).toHaveBeenCalledTimes(2);
  });
});
