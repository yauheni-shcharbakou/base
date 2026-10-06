import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { VideoEventBus } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { StorageVideo } from '@modules/storage/domain/entities/storage.video.interface';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { Logger } from '@nestjs/common';
import { right } from '@sweet-monads/either';
import {
  BunnyVideoStatus,
  VideoSyncWithProviderUseCase,
} from './video.sync-with-provider.use-case';

const { PENDING, UPLOADED, READY, FAILED } = NestStorage.FileUploadStatus;

const providerVideo = (providerId: string, status: number) =>
  ({ providerId, status, duration: 1, views: 0 }) as StorageVideo;

const video = (providerId: string, uploadStatus?: NestStorage.FileUploadStatus) =>
  ({
    id: `video-${providerId}`,
    providerId,
    file: uploadStatus && { uploadStatus },
  }) as NestStorage.VideoPopulated;

describe('VideoSyncWithProviderUseCase', () => {
  let repository: { bulkUpdate: Mock; getMany: Mock };
  let storage: { getList: Mock };
  let eventBus: { emitUploadFinish: Mock; emitUploadFail: Mock };
  let useCase: VideoSyncWithProviderUseCase;

  const sync = async (items: StorageVideo[], videos: NestStorage.VideoPopulated[]) => {
    storage.getList.mockResolvedValue({ items, total: items.length });
    repository.getMany.mockResolvedValue(videos);
    await useCase.execute();
  };

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    repository = { bulkUpdate: vi.fn().mockResolvedValue(right(true)), getMany: vi.fn() };
    storage = { getList: vi.fn() };
    eventBus = { emitUploadFinish: vi.fn(), emitUploadFail: vi.fn() };
    useCase = new VideoSyncWithProviderUseCase(
      repository as unknown as VideoRepository,
      storage as unknown as StorageVideoService,
      eventBus as unknown as VideoEventBus,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('makes READY every encoded video whose row is short of it, whatever it says', async () => {
    const rows = [video('a', PENDING), video('b', UPLOADED), video('c', FAILED)];

    await sync(
      rows.map(({ providerId }) => providerVideo(providerId, BunnyVideoStatus.FINISHED)),
      rows,
    );

    expect(eventBus.emitUploadFinish.mock.calls.map(([row]) => row.providerId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(eventBus.emitUploadFail).not.toHaveBeenCalled();
  });

  it('leaves a READY video alone, and one with no file row read', async () => {
    await sync(
      [
        providerVideo('a', BunnyVideoStatus.FINISHED),
        providerVideo('b', BunnyVideoStatus.FINISHED),
      ],
      [video('a', READY), video('b')],
    );

    expect(eventBus.emitUploadFinish).not.toHaveBeenCalled();
  });

  it('fails a row the provider gave up on, once', async () => {
    await sync(
      [
        providerVideo('a', BunnyVideoStatus.ERROR),
        providerVideo('b', BunnyVideoStatus.UPLOAD_FAILED),
        providerVideo('c', BunnyVideoStatus.ERROR),
      ],
      [video('a', UPLOADED), video('b', PENDING), video('c', FAILED)],
    );

    expect(eventBus.emitUploadFail.mock.calls.map(([row]) => row.providerId)).toEqual(['a', 'b']);
    expect(eventBus.emitUploadFinish).not.toHaveBeenCalled();
  });

  it('waits for an upload or an encode still running', async () => {
    await sync(
      [
        providerVideo('a', BunnyVideoStatus.CREATED),
        providerVideo('b', BunnyVideoStatus.TRANSCODING),
      ],
      [video('a', PENDING), video('b', UPLOADED)],
    );

    expect(eventBus.emitUploadFinish).not.toHaveBeenCalled();
    expect(eventBus.emitUploadFail).not.toHaveBeenCalled();
  });

  it('reads no rows for an empty page', async () => {
    await sync([], []);

    expect(repository.getMany).not.toHaveBeenCalled();
  });
});
