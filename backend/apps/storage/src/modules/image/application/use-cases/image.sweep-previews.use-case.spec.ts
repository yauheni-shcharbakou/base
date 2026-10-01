import { Config } from '@/config';
import { ImageMakePreviewUseCase } from '@modules/image/application/use-cases/image.make-preview.use-case';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { left, right } from '@sweet-monads/either';
import { ImageSweepPreviewsUseCase } from './image.sweep-previews.use-case';

const NOW = new Date('2026-01-01T12:00:00Z');
const LIMIT = 7;
const GRACE_MINUTES = 25;

describe('ImageSweepPreviewsUseCase', () => {
  let repository: { getManyWithoutPreview: jest.Mock };
  let makePreviewUseCase: { execute: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let useCase: ImageSweepPreviewsUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    repository = { getManyWithoutPreview: jest.fn().mockResolvedValue([]) };
    makePreviewUseCase = { execute: jest.fn().mockResolvedValue(right(undefined)) };
    configService = {
      getOrThrow: jest.fn().mockReturnValue({ limit: LIMIT, graceMinutes: GRACE_MINUTES }),
    };
    useCase = new ImageSweepPreviewsUseCase(
      repository as unknown as ImageRepository,
      makePreviewUseCase as unknown as ImageMakePreviewUseCase,
      configService as unknown as ConfigService<Config>,
    );
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
    );
  });

  it('goes on to the next image when one gets no preview', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([
      { id: 'image-1', fileId: 'file-1' },
      { id: 'image-2', fileId: 'file-2' },
    ]);
    makePreviewUseCase.execute.mockResolvedValueOnce(left(new Error('provider down')));

    await useCase.execute();

    expect(makePreviewUseCase.execute.mock.calls).toEqual([
      [{ fileId: 'file-1' }],
      [{ fileId: 'file-2' }],
    ]);
  });
});
