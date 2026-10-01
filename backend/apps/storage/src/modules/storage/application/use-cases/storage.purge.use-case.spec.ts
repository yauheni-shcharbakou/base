import { FilePurgeEvent, FilePurgeType } from '@backend/event-bus';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { InternalServerErrorException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { StoragePurgeUseCase } from './storage.purge.use-case';

describe('StoragePurgeUseCase', () => {
  let fileService: { deleteFile: jest.Mock };
  let videoService: { deleteVideo: jest.Mock };
  let useCase: StoragePurgeUseCase;

  beforeEach(() => {
    fileService = { deleteFile: jest.fn().mockResolvedValue(right(true)) };
    videoService = { deleteVideo: jest.fn().mockResolvedValue(right(true)) };

    useCase = new StoragePurgeUseCase(
      fileService as unknown as StorageFileService,
      videoService as unknown as StorageVideoService,
    );
  });

  it('deletes a file or an image from Bunny Storage', async () => {
    const result = await useCase.execute({ type: FilePurgeType.FILE, providerId: 'dev/a.png' });

    expect(result.isRight()).toBe(true);
    expect(fileService.deleteFile).toHaveBeenCalledWith('dev/a.png');
    expect(videoService.deleteVideo).not.toHaveBeenCalled();
  });

  it('deletes a video from Bunny Stream', async () => {
    const result = await useCase.execute({ type: FilePurgeType.VIDEO, providerId: 'guid' });

    expect(result.isRight()).toBe(true);
    expect(videoService.deleteVideo).toHaveBeenCalledWith('guid');
    expect(fileService.deleteFile).not.toHaveBeenCalled();
  });

  // The controller throws on a left, which is what makes BullMQ retry the job.
  it('passes a provider failure through', async () => {
    const failure = new InternalServerErrorException('Bunny is down');
    fileService.deleteFile.mockResolvedValue(left(failure));

    const result = await useCase.execute({ type: FilePurgeType.FILE, providerId: 'dev/a.png' });

    expect(result.isLeft() && result.value).toBe(failure);
  });

  it('refuses a type it does not know, touching no provider', async () => {
    const event = { type: 'image', providerId: 'x' } as unknown as FilePurgeEvent;

    const result = await useCase.execute(event);

    expect(result.isLeft() && result.value).toBeInstanceOf(InternalServerErrorException);
    expect(fileService.deleteFile).not.toHaveBeenCalled();
    expect(videoService.deleteVideo).not.toHaveBeenCalled();
  });
});
