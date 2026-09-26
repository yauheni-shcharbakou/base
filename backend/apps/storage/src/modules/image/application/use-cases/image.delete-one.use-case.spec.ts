import { FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { ImageDeleteOneUseCase } from './image.delete-one.use-case';

const image = {
  id: 'image-1',
  file: { id: 'file-1', providerId: 'dev/a.png' },
} as NestStorage.ImagePopulated;

// The generated query marks its list filters required; a delete by id sets none of them.
const byId = (id: string) => ({ id }) as NestStorage.ImageQuery;

describe('ImageDeleteOneUseCase', () => {
  let repository: { getOne: jest.Mock; deleteWithFile: jest.Mock };
  let purgeService: { purge: jest.Mock };
  let useCase: ImageDeleteOneUseCase;

  beforeEach(() => {
    repository = {
      getOne: jest.fn().mockResolvedValue(right(image)),
      deleteWithFile: jest.fn().mockResolvedValue(right(image)),
    };
    purgeService = { purge: jest.fn().mockResolvedValue(undefined) };

    useCase = new ImageDeleteOneUseCase(
      repository as unknown as ImageRepository,
      purgeService as unknown as FilePurgeService,
    );
  });

  it('deletes the image with its file row, then purges the object', async () => {
    const result = await useCase.execute(byId(image.id));

    expect(result.isRight()).toBe(true);
    expect(repository.deleteWithFile).toHaveBeenCalledWith(image.id);
    expect(purgeService.purge).toHaveBeenCalledWith([
      { type: FilePurgeType.FILE, providerId: 'dev/a.png' },
    ]);
    expect(repository.deleteWithFile.mock.invocationCallOrder[0]).toBeLessThan(
      purgeService.purge.mock.invocationCallOrder[0],
    );
  });

  it('purges nothing when the rows stay', async () => {
    repository.deleteWithFile.mockResolvedValue(left(new Error('flush failed')));

    const result = await useCase.execute(byId(image.id));

    expect(result.isLeft()).toBe(true);
    expect(purgeService.purge).not.toHaveBeenCalled();
  });

  it('purges nothing for an image whose bytes never reached the provider', async () => {
    repository.getOne.mockResolvedValue(right({ ...image, file: { id: 'file-1' } }));

    await useCase.execute(byId(image.id));

    expect(repository.deleteWithFile).toHaveBeenCalled();
    expect(purgeService.purge).not.toHaveBeenCalled();
  });

  it('touches nothing for a missing image', async () => {
    repository.getOne.mockResolvedValue(left(new NotFoundException()));

    const result = await useCase.execute(byId('missing'));

    expect(result.isLeft()).toBe(true);
    expect(repository.deleteWithFile).not.toHaveBeenCalled();
    expect(purgeService.purge).not.toHaveBeenCalled();
  });
});
