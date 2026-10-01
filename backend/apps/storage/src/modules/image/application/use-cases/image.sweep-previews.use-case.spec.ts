import { Config } from '@/config';
import { ImageMakePreviewUseCase } from '@modules/image/application/use-cases/image.make-preview.use-case';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { left, right } from '@sweet-monads/either';
import { ImageSweepPreviewsUseCase } from './image.sweep-previews.use-case';

const SETTINGS = { limit: 2, graceMinutes: 25, maxAttempts: 3, breakerThreshold: 0 };

// What a sweep does is specced once, on `PreviewSweepUseCase`; here, what the image sweep runs on.
describe('ImageSweepPreviewsUseCase', () => {
  let repository: { getManyWithoutPreview: jest.Mock; countPreviewAttempt: jest.Mock };
  let makePreviewUseCase: { execute: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let useCase: ImageSweepPreviewsUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    repository = {
      getManyWithoutPreview: jest.fn().mockResolvedValue([{ id: 'image-1', fileId: 'file-1' }]),
      countPreviewAttempt: jest.fn().mockResolvedValue(right(false)),
    };
    makePreviewUseCase = { execute: jest.fn().mockResolvedValue(right(true)) };
    configService = { getOrThrow: jest.fn().mockReturnValue(SETTINGS) };

    useCase = new ImageSweepPreviewsUseCase(
      repository as unknown as ImageRepository,
      makePreviewUseCase as unknown as ImageMakePreviewUseCase,
      configService as unknown as ConfigService<Config>,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is tuned by the image sweep settings', () => {
    expect(configService.getOrThrow).toHaveBeenCalledWith('imagePreviewSweep', { infer: true });
  });

  it('reads the images without a preview', async () => {
    await useCase.execute('image-0');

    expect(repository.getManyWithoutPreview).toHaveBeenCalledWith(
      expect.any(Date),
      SETTINGS.limit,
      'image-0',
    );
  });

  it('makes the preview of the file behind each image', async () => {
    await useCase.execute();

    expect(makePreviewUseCase.execute).toHaveBeenCalledWith({ fileId: 'file-1' });
  });

  it('counts a failed sweep against the image', async () => {
    makePreviewUseCase.execute.mockResolvedValue(left(new Error('provider down')));

    await useCase.execute();

    expect(repository.countPreviewAttempt).toHaveBeenCalledWith('image-1', SETTINGS.maxAttempts);
  });
});
