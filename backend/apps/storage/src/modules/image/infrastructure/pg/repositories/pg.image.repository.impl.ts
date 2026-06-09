import { PgMapper, PgRepositoryImpl } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { PgFileEntity } from '@modules/file/infrastructure/pg/entities/pg.file.entity';
import {
  ImageCreate,
  ImageRepository,
  ImageSaveAndPlace,
} from '@modules/image/domain/repositories/image.repository';
import { PgStorageObjectEntity } from '@modules/storage-object/infrastructure/pg/entities/pg.storage-object.entity';
import { Either, left, right } from '@sweet-monads/either';
import { PgImageEntity } from '../entities/pg.image.entity';

export class PgImageRepositoryImpl
  extends PgRepositoryImpl<PgImageEntity, NestStorage.Image, NestStorage.ImageQuery, ImageCreate>
  implements ImageRepository
{
  constructor(
    @InjectRepository(PgImageEntity) protected readonly repository: EntityRepository<PgImageEntity>,
  ) {
    super(repository, new PgMapper());
  }

  async saveAndPlaceOne(createData: ImageSaveAndPlace): Promise<Either<Error, NestStorage.Image>> {
    try {
      const image = await this.em.transactional(async (em) => {
        const fileEntity = em.create(PgFileEntity, {
          ...createData.file,
          userId: createData.image.userId,
          uploadId: createData.image.uploadId,
        });

        const imageEntity = em.create(PgImageEntity, {
          ...createData.image,
          file: fileEntity.id,
        });

        em.persist([fileEntity, imageEntity]);

        if (createData.storageObject) {
          const storageObjectEntity = em.create(PgStorageObjectEntity, {
            ...createData.storageObject,
            file: fileEntity.id,
            image: imageEntity.id,
            userId: fileEntity.userId,
            type: NestStorage.StorageObjectType.IMAGE,
            isFolder: false,
          });

          em.persist(storageObjectEntity);
        }

        await em.flush();
        return this.mapper.stringify(imageEntity);
      });

      return right(image);
    } catch (error) {
      return left(error);
    }
  }

  async saveAndPlaceMany(items: ImageSaveAndPlace[]): Promise<Either<Error, NestStorage.Image[]>> {
    try {
      const images = await this.em.transactional(async (em) => {
        const imageEntities: PgImageEntity[] = [];

        for (const item of items) {
          const fileEntity = em.create(PgFileEntity, {
            ...item.file,
            userId: item.image.userId,
            uploadId: item.image.uploadId,
          });

          const imageEntity = em.create(PgImageEntity, {
            ...item.image,
            file: fileEntity.id,
          });

          em.persist([fileEntity, imageEntity]);
          imageEntities.push(imageEntity);

          if (item.storageObject) {
            const storageObjectEntity = em.create(PgStorageObjectEntity, {
              ...item.storageObject,
              file: fileEntity.id,
              image: imageEntity.id,
              userId: fileEntity.userId,
              type: NestStorage.StorageObjectType.IMAGE,
              isFolder: false,
            });

            em.persist(storageObjectEntity);
          }
        }

        await em.flush();
        return this.mapper.stringifyMany(imageEntities);
      });

      return right(images);
    } catch (error) {
      return left(error);
    }
  }
}
