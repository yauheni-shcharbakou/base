import { NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException } from '@nestjs/common';
import { StorageObjectValidationService } from './storage-object.validation.service';

describe('StorageObjectValidationService', () => {
  let repository: { isExists: jest.Mock; distinct: jest.Mock };
  let service: StorageObjectValidationService;

  beforeEach(() => {
    repository = {
      isExists: jest.fn().mockResolvedValue(false),
      distinct: jest.fn().mockResolvedValue(new Set()),
    };

    service = new StorageObjectValidationService(repository as unknown as StorageObjectRepository);
  });

  describe('validateNameIsFree', () => {
    const target = { id: 'moved', name: 'docs', parent: 'target', isFolder: true };

    it('looks for another live folder of that name in the target folder', async () => {
      const result = await service.validateNameIsFree(target);

      expect(result.isRight() && result.value).toBe('docs');
      expect(repository.isExists).toHaveBeenCalledWith({
        parent: 'target',
        name: 'docs',
        isDeleted: false,
        type: NestStorage.StorageObjectType.FOLDER,
        excludeIds: ['moved'],
      });
    });

    // Create suffixes a file name that any sibling has, a folder included, so an update may not
    // take one either.
    it('counts any live object against a file name', async () => {
      await service.validateNameIsFree({ ...target, name: 'a.txt', isFolder: false });

      expect(repository.isExists).toHaveBeenCalledWith({
        parent: 'target',
        name: 'a.txt',
        isDeleted: false,
        excludeIds: ['moved'],
      });
    });

    it('refuses a taken name, a file’s as well as a folder’s', async () => {
      repository.isExists.mockResolvedValue(true);

      const folder = await service.validateNameIsFree(target);
      const file = await service.validateNameIsFree({ ...target, name: 'a.txt', isFolder: false });

      expect(folder.isLeft() && folder.value).toBeInstanceOf(BadRequestException);
      expect(file.isLeft() && file.value).toBeInstanceOf(BadRequestException);
    });
  });

  describe('validateObjectName', () => {
    // A deleted object is hidden and only waits for the cleanup crons; its name is free already.
    it('does not count a deleted folder against a new one', async () => {
      const result = await service.validateObjectName({
        name: 'docs',
        type: NestStorage.StorageObjectType.FOLDER,
        parent: 'root',
      });

      expect(result.isRight() && result.value).toBe('docs');
      expect(repository.isExists).toHaveBeenCalledWith({
        parent: 'root',
        name: 'docs',
        isDeleted: false,
        type: NestStorage.StorageObjectType.FOLDER,
      });
    });

    it('suffixes a taken file name past the live siblings only', async () => {
      repository.distinct.mockResolvedValue(new Set(['a.txt', 'a (1).txt']));

      const result = await service.validateObjectName({
        name: 'a.txt',
        type: NestStorage.StorageObjectType.FILE,
        parent: 'root',
      });

      expect(result.isRight() && result.value).toBe('a (2).txt');
      expect(repository.distinct).toHaveBeenCalledWith('name', {
        parent: 'root',
        nameStartsWith: 'a',
        isDeleted: false,
      });
    });
  });
});
