import { Logger } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { PreviewSweepSettings, PreviewSweepUseCase } from './preview.sweep.use-case';

const NOW = new Date('2026-01-01T12:00:00Z');
const LIMIT = 2;
const GRACE_MINUTES = 25;
const MAX_ATTEMPTS = 3;

interface Row {
  id: string;
}

const row = (n: number): Row => ({ id: `row-${n}` });

describe('PreviewSweepUseCase', () => {
  let getRows: jest.Mock;
  let makePreview: jest.Mock;
  let countPreviewAttempt: jest.Mock;
  let useCase: PreviewSweepUseCase<Row>;

  // The sweep over whatever the three mocks answer for.
  class SweepUseCase extends PreviewSweepUseCase<Row> {
    constructor(settings: PreviewSweepSettings) {
      super('Row', settings);
    }

    protected getRows(...args: unknown[]): Promise<Row[]> {
      return getRows(...args);
    }

    protected makePreview(...args: unknown[]): Promise<Either<Error, boolean>> {
      return makePreview(...args);
    }

    protected countPreviewAttempt(...args: unknown[]): Promise<Either<Error, boolean>> {
      return countPreviewAttempt(...args);
    }
  }

  const create = (maxAttempts = MAX_ATTEMPTS, breakerThreshold = 0) =>
    new SweepUseCase({ limit: LIMIT, graceMinutes: GRACE_MINUTES, maxAttempts, breakerThreshold });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    getRows = jest.fn().mockResolvedValue([]);
    // `right(true)`: a preview made of an original the provider gave.
    makePreview = jest.fn().mockResolvedValue(right(true));
    countPreviewAttempt = jest.fn().mockResolvedValue(right(false));
    useCase = create();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reads the rows READY for longer than the grace, up to the limit', async () => {
    await useCase.execute();

    expect(getRows).toHaveBeenCalledWith(
      new Date(NOW.getTime() - GRACE_MINUTES * 60_000),
      LIMIT,
      undefined,
    );
  });

  it('reads past the id it is given', async () => {
    await useCase.execute('row-7');

    expect(getRows).toHaveBeenCalledWith(expect.any(Date), LIMIT, 'row-7');
  });

  it('answers the last id of a full batch, to go on from', async () => {
    getRows.mockResolvedValue([row(1), row(2)]);

    expect(await useCase.execute()).toBe('row-2');
  });

  it('answers nothing once the backlog ended in the batch', async () => {
    getRows.mockResolvedValue([row(1)]);
    expect(await useCase.execute()).toBeUndefined();

    getRows.mockResolvedValue([]);
    expect(await useCase.execute()).toBeUndefined();
  });

  it('goes on to the next row when one gets no preview, and past both', async () => {
    getRows.mockResolvedValue([row(1), row(2)]);
    makePreview.mockResolvedValueOnce(left(new Error('provider down')));

    expect(await useCase.execute()).toBe('row-2');
    expect(makePreview.mock.calls).toEqual([[row(1)], [row(2)]]);
  });

  it('counts an attempt against the row that got no preview, and against no other', async () => {
    getRows.mockResolvedValue([row(1), row(2)]);
    makePreview.mockResolvedValueOnce(left(new Error('provider down')));

    await useCase.execute();

    expect(countPreviewAttempt.mock.calls).toEqual([['row-1', MAX_ATTEMPTS]]);
  });

  it('counts nothing when it never gives up', async () => {
    useCase = create(0);
    getRows.mockResolvedValue([row(1)]);
    makePreview.mockResolvedValue(left(new Error('provider down')));

    await useCase.execute();

    expect(countPreviewAttempt).not.toHaveBeenCalled();
  });

  it('goes on with the batch when an attempt cannot be counted', async () => {
    getRows.mockResolvedValue([row(1), row(2)]);
    makePreview.mockResolvedValue(left(new Error('provider down')));
    countPreviewAttempt.mockResolvedValueOnce(left(new Error('db down')));

    expect(await useCase.execute()).toBe('row-2');
    expect(countPreviewAttempt).toHaveBeenCalledTimes(2);
  });

  describe('the breaker', () => {
    const DOWN = left(new Error('provider down'));

    beforeEach(() => {
      useCase = create(MAX_ATTEMPTS, 2);
      getRows.mockResolvedValue([row(1), row(2), row(3)]);
    });

    it('stops the sweep at so many rows in a row without a preview, and counts none', async () => {
      getRows.mockResolvedValue([row(1), row(2)]);
      makePreview.mockResolvedValue(DOWN);

      expect(await useCase.execute()).toBeUndefined();
      expect(countPreviewAttempt).not.toHaveBeenCalled();
    });

    it('leaves the rest of the batch alone once it stopped', async () => {
      makePreview.mockResolvedValue(DOWN);

      await useCase.execute();

      expect(makePreview).toHaveBeenCalledTimes(2);
    });

    it('counts the rows that failed before one the provider answered for', async () => {
      makePreview
        .mockResolvedValueOnce(DOWN)
        .mockResolvedValueOnce(right(true))
        .mockResolvedValueOnce(DOWN);

      await useCase.execute();

      expect(makePreview).toHaveBeenCalledTimes(3);
      expect(countPreviewAttempt.mock.calls).toEqual([
        ['row-1', MAX_ATTEMPTS],
        ['row-3', MAX_ATTEMPTS],
      ]);
    });

    it('keeps the run going over a row that never asked the provider', async () => {
      makePreview
        .mockResolvedValueOnce(DOWN)
        .mockResolvedValueOnce(right(false))
        .mockResolvedValueOnce(DOWN);

      expect(await useCase.execute()).toBeUndefined();
      expect(countPreviewAttempt).not.toHaveBeenCalled();
    });

    it('never stops at a threshold of 0', async () => {
      useCase = create(MAX_ATTEMPTS, 0);
      makePreview.mockResolvedValue(DOWN);

      await useCase.execute();

      expect(makePreview).toHaveBeenCalledTimes(3);
      expect(countPreviewAttempt).toHaveBeenCalledTimes(3);
    });

    it('warns of a threshold no batch is long enough for', () => {
      const warn = jest.spyOn(Logger.prototype, 'warn');

      create(MAX_ATTEMPTS, LIMIT + 1);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('never stops a sweep'));
    });
  });
});
