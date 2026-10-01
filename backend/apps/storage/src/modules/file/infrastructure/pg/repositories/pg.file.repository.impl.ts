import { PgRepositoryImpl } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { buildLeafStorageObject } from '@common/infrastructure/pg/factories/pg.storage-object.factory';
import { FilterQuery } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  FileRepository,
  FileSaveAndPlace,
  FileWithMedia,
} from '@modules/file/domain/repositories/file.repository';
import { StorageDatabaseEntity } from '@packages/common';
import { Either, left, right } from '@sweet-monads/either';
import { PgFileMapper } from '../mappers/pg.file.mapper';

export class PgFileRepositoryImpl
  extends PgRepositoryImpl<PgFileEntity, NestStorage.File, NestStorage.FileQuery>
  implements FileRepository
{
  protected readonly resourceName = 'File';

  constructor(
    @InjectRepository(PgFileEntity) protected readonly repository: EntityRepository<PgFileEntity>,
  ) {
    super(repository, new PgFileMapper());
  }

  async saveAndPlaceOne(createData: FileSaveAndPlace): Promise<Either<Error, NestStorage.File>> {
    try {
      const file = await this.em.transactional(async (em) => {
        const fileEntity = em.create(PgFileEntity, createData.file);
        em.persist(fileEntity);

        if (createData.storageObject) {
          const storageObjectEntity = em.create(
            PgStorageObjectEntity,
            buildLeafStorageObject({
              meta: createData.storageObject,
              userId: fileEntity.userId,
              type: NestStorage.StorageObjectType.FILE,
              fileId: fileEntity.id,
            }),
          );

          em.persist(storageObjectEntity);
        }

        await em.flush();
        return this.mapper.stringify(fileEntity);
      });

      return right(file);
    } catch (error) {
      return left(error);
    }
  }

  async saveAndPlaceMany(items: FileSaveAndPlace[]): Promise<Either<Error, NestStorage.File[]>> {
    try {
      const files = await this.em.transactional(async (em) => {
        const fileEntities: PgFileEntity[] = [];

        for (const item of items) {
          const fileEntity = em.create(PgFileEntity, item.file);
          em.persist(fileEntity);
          fileEntities.push(fileEntity);

          if (item.storageObject) {
            const storageObjectEntity = em.create(
              PgStorageObjectEntity,
              buildLeafStorageObject({
                meta: item.storageObject,
                userId: fileEntity.userId,
                type: NestStorage.StorageObjectType.FILE,
                fileId: fileEntity.id,
              }),
            );

            em.persist(storageObjectEntity);
          }
        }

        await em.flush();
        return this.mapper.stringifyMany(fileEntities);
      });

      return right(files);
    } catch (error) {
      return left(error);
    }
  }

  // A filter on the relation rather than a `FileQuery` field: the proto query is the public
  // contract, and "placed in a deleted storage object" is a cleanup concern only.
  async getManyInDeletedStorageObjects(limit: number): Promise<FileWithMedia[]> {
    // `storageObject` is typed as the proto read model, which does not carry the soft-delete flag;
    // the entity behind the relation does, and that is what MikroORM resolves the filter against.
    const entities = await this.repository.find(
      { storageObject: { isDeleted: true } } as FilterQuery<PgFileEntity>,
      { populate: ['video', 'image'], limit },
    );

    return this.mapper.stringifyMany(entities) as FileWithMedia[];
  }

  // Straight to the table, like `setPreview`: `updateMany` reads the rows and then writes them,
  // and would turn FAILED a row that went READY in between.
  async failPendingBefore(createdBefore: Date): Promise<Either<Error, number>> {
    try {
      const affected = await this.repository.nativeUpdate(
        {
          uploadStatus: NestStorage.FileUploadStatus.PENDING,
          createdAt: { $lte: createdBefore },
        } as FilterQuery<PgFileEntity>,
        { uploadStatus: NestStorage.FileUploadStatus.FAILED, updatedAt: new Date() },
      );

      return right(affected);
    } catch (error) {
      return left(error as Error);
    }
  }

  async getOwnerIds(): Promise<string[]> {
    const rows = await this.em.execute<{ user_id: string }[]>(
      `SELECT DISTINCT user_id FROM "${StorageDatabaseEntity.FILE}"`,
    );

    return rows.map((row) => row.user_id);
  }

  async getManyByOwner(userId: string, limit: number): Promise<FileWithMedia[]> {
    const entities = await this.repository.find(
      { userId },
      { populate: ['video', 'image'], limit },
    );

    return this.mapper.stringifyMany(entities) as FileWithMedia[];
  }

  async getManyWithoutPreview(
    mimeTypes: string[],
    readyBefore: Date,
    limit: number,
  ): Promise<NestStorage.File[]> {
    try {
      const files = await this.repository.find(
        {
          mimeType: { $in: mimeTypes },
          uploadStatus: NestStorage.FileUploadStatus.READY,
          updatedAt: { $lt: readyBefore },
          previewProviderId: null,
          previewFailedAt: null,
        } as FilterQuery<PgFileEntity>,
        { orderBy: { id: 'asc' }, limit },
      );

      return this.mapper.stringifyMany(files);
    } catch (error) {
      throw this.toFailure('read previewless', error);
    }
  }

  // Straight to the table, conditional on no key yet: the event handler and the sweep can race on
  // one file, and the row may be deleted under either. Neither must overwrite what the other set.
  async setPreview(id: string, previewProviderId: string): Promise<Either<Error, boolean>> {
    return this.updateWithoutPreview(id, { previewProviderId });
  }

  async markPreviewFailed(id: string): Promise<Either<Error, boolean>> {
    return this.updateWithoutPreview(id, { previewFailedAt: new Date() });
  }

  private async updateWithoutPreview(
    id: string,
    set: Partial<Pick<PgFileEntity, 'previewProviderId' | 'previewFailedAt'>>,
  ): Promise<Either<Error, boolean>> {
    try {
      const affected = await this.repository.nativeUpdate(
        { id, previewProviderId: null },
        { ...set, updatedAt: new Date() },
      );

      return right(affected > 0);
    } catch (error) {
      return left(error as Error);
    }
  }
}
