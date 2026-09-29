import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { FileRepository, FileWithMedia } from '@modules/file/domain/repositories/file.repository';
import { FileDropService } from './file.drop.service';

const files = [{ id: 'f1', providerId: 'dev/a.png' }, { id: 'f2' }] as FileWithMedia[];

describe('FileDropService', () => {
  let repository: { deleteMany: jest.Mock };
  let purgeService: { purgeFiles: jest.Mock };
  let service: FileDropService;

  beforeEach(() => {
    repository = { deleteMany: jest.fn().mockResolvedValue(true) };
    purgeService = { purgeFiles: jest.fn().mockResolvedValue(undefined) };
    service = new FileDropService(
      repository as unknown as FileRepository,
      purgeService as unknown as FilePurgeService,
    );
  });

  it('deletes the rows it was given by id, then purges them', async () => {
    await expect(service.drop(files)).resolves.toBe(true);

    expect(repository.deleteMany).toHaveBeenCalledWith({ ids: ['f1', 'f2'] });
    expect(purgeService.purgeFiles).toHaveBeenCalledWith(files);
  });

  it('purges nothing when the rows were gone already', async () => {
    repository.deleteMany.mockResolvedValue(false);

    await expect(service.drop(files)).resolves.toBe(false);

    expect(purgeService.purgeFiles).not.toHaveBeenCalled();
  });

  it('throws a failed delete and purges nothing', async () => {
    repository.deleteMany.mockRejectedValue(new Error('db down'));

    await expect(service.drop(files)).rejects.toThrow('db down');

    expect(purgeService.purgeFiles).not.toHaveBeenCalled();
  });

  it('touches nothing for no rows', async () => {
    await expect(service.drop([])).resolves.toBe(false);

    expect(repository.deleteMany).not.toHaveBeenCalled();
  });
});
