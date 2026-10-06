import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NestStorage } from '@backend/proto';
import { NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { firstValueFrom } from 'rxjs';
import { GrpcStorageObjectController } from './grpc.storage-object.controller';

const row = (id: string) => ({ id, name: `${id}.txt` }) as NestStorage.StorageObject;
const populated = (id: string) =>
  ({ ...row(id), file: { id: `file-of-${id}` } }) as NestStorage.StorageObjectPopulated;

describe('GrpcStorageObjectController batch writes', () => {
  let getUseCase: { getMany: Mock };
  let deleteManyUseCase: { execute: Mock };
  let moveManyUseCase: { execute: Mock };
  let updatePublicManyUseCase: { execute: Mock };
  let controller: GrpcStorageObjectController;

  beforeEach(() => {
    // Read back in another order than written, as the database may.
    getUseCase = { getMany: vi.fn().mockResolvedValue([populated('b'), populated('a')]) };
    deleteManyUseCase = { execute: vi.fn().mockResolvedValue(right([row('a'), row('b')])) };
    moveManyUseCase = { execute: vi.fn().mockResolvedValue(right([row('a'), row('b')])) };
    updatePublicManyUseCase = {
      execute: vi.fn().mockResolvedValue(right([row('a'), row('b')])),
    };

    const unused = {} as never;
    controller = new GrpcStorageObjectController(
      getUseCase as never,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      deleteManyUseCase as never,
      moveManyUseCase as never,
      unused,
      updatePublicManyUseCase as never,
    );
  });

  // `StorageObjectArray` carries populated objects: a bare row's media reference fails to
  // serialize, so a batch holding a file answered INTERNAL after its write had gone through.
  it('answers a delete with the deleted rows read back with their media, in order', async () => {
    const answer = await firstValueFrom(controller.deleteMany({ ids: ['a', 'b'] }));

    expect(answer.items.map(({ id, file }) => [id, file?.id])).toEqual([
      ['a', 'file-of-a'],
      ['b', 'file-of-b'],
    ]);
    expect(getUseCase.getMany).toHaveBeenCalledWith(
      { ids: ['a', 'b'], isDeleted: true },
      { populate: expect.arrayContaining(['file', 'image', 'video']) },
    );
  });

  it('answers a move with the moved rows read back live', async () => {
    const answer = await firstValueFrom(controller.moveMany({ ids: ['a', 'b'], parent: 'p' }));

    expect(answer.items.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(getUseCase.getMany).toHaveBeenCalledWith(
      { ids: ['a', 'b'], isDeleted: false },
      expect.anything(),
    );
  });

  it('answers a visibility change with the rows read back live, with their media', async () => {
    const answer = await firstValueFrom(
      controller.updatePublicMany({ ids: ['a', 'b'], isPublic: true }),
    );

    expect(answer.items.map(({ id, file }) => [id, file?.id])).toEqual([
      ['a', 'file-of-a'],
      ['b', 'file-of-b'],
    ]);
    expect(getUseCase.getMany).toHaveBeenCalledWith(
      { ids: ['a', 'b'], isDeleted: false },
      expect.anything(),
    );
  });

  it('reads nothing back when the write was refused', async () => {
    moveManyUseCase.execute.mockResolvedValue(
      left(new NotFoundException('Storage object not found')),
    );

    await expect(
      firstValueFrom(controller.moveMany({ ids: ['a'], parent: 'p' })),
    ).rejects.toBeDefined();
    expect(getUseCase.getMany).not.toHaveBeenCalled();
  });
});
