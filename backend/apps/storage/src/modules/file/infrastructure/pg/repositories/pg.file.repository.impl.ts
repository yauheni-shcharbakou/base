import { PgRepositoryImpl } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { buildLeafStorageObject } from '@common/infrastructure/pg/factories/pg.storage-object.factory';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  FileRepository,
  FileSaveAndPlace,
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
}
