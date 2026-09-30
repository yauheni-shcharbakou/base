import { FileEventBus, FilePurgeType } from '@backend/event-bus';
import { Logger } from '@nestjs/common';
import { FilePurgeService } from './file.purge.service';

describe('FilePurgeService', () => {
  let eventBus: { emitManyPurge: jest.Mock };
  let service: FilePurgeService;

  beforeEach(() => {
    eventBus = { emitManyPurge: jest.fn().mockResolvedValue([]) };
    service = new FilePurgeService(eventBus as unknown as FileEventBus);
  });

  describe('purgeFiles', () => {
    it('purges a video by its own guid, never by its file row', async () => {
      await service.purgeFiles([
        { id: 'f1', providerId: 'ignored', video: { providerId: 'guid' } },
      ]);

      expect(eventBus.emitManyPurge).toHaveBeenCalledWith([
        { type: FilePurgeType.VIDEO, providerId: 'guid' },
      ]);
    });

    it('purges a plain file or an image by the file row', async () => {
      await service.purgeFiles([{ id: 'f1', providerId: 'dev/a.png' }]);

      expect(eventBus.emitManyPurge).toHaveBeenCalledWith([
        { type: FilePurgeType.FILE, providerId: 'dev/a.png' },
      ]);
    });

    it("purges an image's preview beside its original", async () => {
      await service.purgeFiles([
        { id: 'f1', providerId: 'dev/a.gif', image: { previewProviderId: 'dev/a.preview.webp' } },
      ]);

      expect(eventBus.emitManyPurge).toHaveBeenCalledWith([
        { type: FilePurgeType.FILE, providerId: 'dev/a.gif' },
        { type: FilePurgeType.FILE, providerId: 'dev/a.preview.webp' },
      ]);
    });

    it("purges a plain file's own preview — a PDF's first page — beside it", async () => {
      await service.purgeFiles([
        { id: 'f1', providerId: 'dev/a.pdf', previewProviderId: 'dev/a.preview.webp' },
      ]);

      expect(eventBus.emitManyPurge).toHaveBeenCalledWith([
        { type: FilePurgeType.FILE, providerId: 'dev/a.pdf' },
        { type: FilePurgeType.FILE, providerId: 'dev/a.preview.webp' },
      ]);
    });

    it('purges a light original that is its own preview once', async () => {
      await service.purgeFiles([
        { id: 'f1', providerId: 'dev/a.png', image: { previewProviderId: 'dev/a.png' } },
      ]);

      expect(eventBus.emitManyPurge).toHaveBeenCalledWith([
        { type: FilePurgeType.FILE, providerId: 'dev/a.png' },
      ]);
    });

    it('skips a row that never reached the provider, and emits nothing for none', async () => {
      await service.purgeFiles([{ id: 'f1' }, { id: 'f2', video: { providerId: '' } }]);

      expect(eventBus.emitManyPurge).not.toHaveBeenCalled();
    });

    it('emits one event per object, in one call', async () => {
      await service.purgeFiles([
        { id: 'f1', providerId: 'dev/a.png' },
        { id: 'f2', video: { providerId: 'guid' } },
      ]);

      expect(eventBus.emitManyPurge).toHaveBeenCalledTimes(1);
      expect(eventBus.emitManyPurge.mock.calls[0][0]).toHaveLength(2);
    });
  });

  // The rows are already gone when this runs, so a failed emit cannot undo the delete — it is
  // logged with the keys and swallowed rather than failing the caller's request.
  it('logs a failed emit instead of throwing', async () => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    eventBus.emitManyPurge.mockRejectedValue(new Error('Redis is down'));

    await expect(
      service.purge([{ type: FilePurgeType.FILE, providerId: 'dev/a.png' }]),
    ).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith(expect.stringContaining('dev/a.png'), expect.anything());
    logError.mockRestore();
  });
});
