import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { VideoDeleteOneUseCase } from './video.delete-one.use-case';

// The backing file row of a video never carries a providerId; the Stream guid is on the video.
const video = {
  id: 'video-1',
  providerId: 'guid',
  file: { id: 'file-1', uploadStatus: NestStorage.FileUploadStatus.PENDING },
} as NestStorage.VideoPopulated;

// The generated query marks its list filters required; a delete by id sets none of them.
const byId = (id: string) => ({ id }) as NestStorage.VideoQuery;

describe('VideoDeleteOneUseCase', () => {
  let repository: { getOne: Mock; deleteWithFile: Mock };
  let purgeService: { purge: Mock };
  let useCase: VideoDeleteOneUseCase;

  beforeEach(() => {
    repository = {
      getOne: vi.fn().mockResolvedValue(right(video)),
      deleteWithFile: vi.fn().mockResolvedValue(right(video)),
    };
    purgeService = { purge: vi.fn().mockResolvedValue(undefined) };

    useCase = new VideoDeleteOneUseCase(
      repository as unknown as VideoRepository,
      purgeService as unknown as FilePurgeService,
    );
  });

  // Not gated on READY: the Stream object exists from `createVideo`, before any byte.
  it('deletes the video with its file row, then purges the Stream object by its guid', async () => {
    const result = await useCase.execute(byId(video.id));

    expect(result.isRight()).toBe(true);
    expect(repository.deleteWithFile).toHaveBeenCalledWith(video.id);
    expect(purgeService.purge).toHaveBeenCalledWith([
      { type: FilePurgeType.VIDEO, providerId: 'guid' },
    ]);
    expect(repository.deleteWithFile.mock.invocationCallOrder[0]).toBeLessThan(
      purgeService.purge.mock.invocationCallOrder[0],
    );
  });

  it('purges nothing when the rows stay', async () => {
    repository.deleteWithFile.mockResolvedValue(left(new Error('flush failed')));

    const result = await useCase.execute(byId(video.id));

    expect(result.isLeft()).toBe(true);
    expect(purgeService.purge).not.toHaveBeenCalled();
  });

  it('touches nothing for a missing video', async () => {
    repository.getOne.mockResolvedValue(left(new NotFoundException()));

    const result = await useCase.execute(byId('missing'));

    expect(result.isLeft()).toBe(true);
    expect(repository.deleteWithFile).not.toHaveBeenCalled();
    expect(purgeService.purge).not.toHaveBeenCalled();
  });
});
