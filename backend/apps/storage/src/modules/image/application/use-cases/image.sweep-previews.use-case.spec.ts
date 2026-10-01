import { Config } from '@/config';
import { ImageMakePreviewUseCase } from '@modules/image/application/use-cases/image.make-preview.use-case';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { left, right } from '@sweet-monads/either';
import { ImageSweepPreviewsUseCase } from './image.sweep-previews.use-case';

const NOW = new Date('2026-01-01T12:00:00Z');
const LIMIT = 2;
const GRACE_MINUTES = 25;
const MAX_ATTEMPTS = 3;

const image = (n: number) => ({ id: `image-${n}`, fileId: `file-${n}` });

describe('ImageSweepPreviewsUseCase', () => {
  let repository: { getManyWithoutPreview: jest.Mock; countPreviewAttempt: jest.Mock };
  let makePreviewUseCase: { execute: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let useCase: ImageSweepPreviewsUseCase;

  const create = (maxAttempts = MAX_ATTEMPTS) => {
    configService = {
      getOrThrow: jest
        .fn()
        .mockReturnValue({ limit: LIMIT, graceMinutes: GRACE_MINUTES, maxAttempts }),
    };

    return new ImageSweepPreviewsUseCase(
      repository as unknown as ImageRepository,
      makePreviewUseCase as unknown as ImageMakePreviewUseCase,
      configService as unknown as ConfigService<Config>,
    );
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    repository = {
      getManyWithoutPreview: jest.fn().mockResolvedValue([]),
      countPreviewAttempt: jest.fn().mockResolvedValue(right(false)),
    };
    makePreviewUseCase = { execute: jest.fn().mockResolvedValue(right(undefined)) };
    useCase = create();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reads the images READY for longer than the configured grace, up to the configured limit', async () => {
    await useCase.execute();

    expect(configService.getOrThrow).toHaveBeenCalledWith('imagePreviewSweep', { infer: true });
    expect(repository.getManyWithoutPreview).toHaveBeenCalledWith(
      new Date(NOW.getTime() - GRACE_MINUTES * 60_000),
      LIMIT,
      undefined,
    );
  });

  it('reads past the id it is given', async () => {
    await useCase.execute('image-7');

    expect(repository.getManyWithoutPreview).toHaveBeenCalledWith(
      expect.any(Date),
      LIMIT,
      'image-7',
    );
  });

  it('answers the last id of a full batch, to go on from', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([image(1), image(2)]);

    expect(await useCase.execute()).toBe('image-2');
  });

  it('answers nothing once the backlog ended in the batch', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([image(1)]);
    expect(await useCase.execute()).toBeUndefined();

    repository.getManyWithoutPreview.mockResolvedValue([]);
    expect(await useCase.execute()).toBeUndefined();
  });

  it('goes on to the next image when one gets no preview, and past both', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([image(1), image(2)]);
    makePreviewUseCase.execute.mockResolvedValueOnce(left(new Error('provider down')));

    expect(await useCase.execute()).toBe('image-2');
    expect(makePreviewUseCase.execute.mock.calls).toEqual([
      [{ fileId: 'file-1' }],
      [{ fileId: 'file-2' }],
    ]);
  });

  it('counts an attempt against the image that got no preview, and against no other', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([image(1), image(2)]);
    makePreviewUseCase.execute.mockResolvedValueOnce(left(new Error('provider down')));

    await useCase.execute();

    expect(repository.countPreviewAttempt.mock.calls).toEqual([['image-1', MAX_ATTEMPTS]]);
  });

  it('counts nothing when it never gives up', async () => {
    useCase = create(0);
    repository.getManyWithoutPreview.mockResolvedValue([image(1)]);
    makePreviewUseCase.execute.mockResolvedValue(left(new Error('provider down')));

    await useCase.execute();

    expect(repository.countPreviewAttempt).not.toHaveBeenCalled();
  });

  it('goes on with the batch when an attempt cannot be counted', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([image(1), image(2)]);
    makePreviewUseCase.execute.mockResolvedValue(left(new Error('provider down')));
    repository.countPreviewAttempt.mockResolvedValueOnce(left(new Error('db down')));

    expect(await useCase.execute()).toBe('image-2');
    expect(repository.countPreviewAttempt).toHaveBeenCalledTimes(2);
  });
});
