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
  FileWithVideo,
} from '@modules/file/domain/repositories/file.repository';
import { Either, left, right } from '@sweet-monads/either';
import { PgFileMapper } from '../mappers/pg.file.mapper';

export class PgFileRepositoryImpl
  extends PgRepositoryImpl<PgFileEntity, NestStorage.File, NestStorage.FileQuery>
  implements FileRepository
{
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
  async getManyInDeletedStorageObjects(limit: number): Promise<FileWithVideo[]> {
    // `storageObject` is typed as the proto read model, which does not carry the soft-delete flag;
    // the entity behind the relation does, and that is what MikroORM resolves the filter against.
    const entities = await this.repository.find(
      { storageObject: { isDeleted: true } } as FilterQuery<PgFileEntity>,
      { populate: ['video'], limit },
    );

    return this.mapper.stringifyMany(entities) as FileWithVideo[];
  }
}
