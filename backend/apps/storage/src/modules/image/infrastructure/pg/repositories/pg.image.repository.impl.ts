import { PgRepositoryImpl } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { buildLeafStorageObject } from '@common/infrastructure/pg/factories/pg.storage-object.factory';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  ImageCreate,
  ImageRepository,
  ImageSaveAndPlace,
} from '@modules/image/domain/repositories/image.repository';
import { NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { PgImageMapper } from '../mappers/pg.image.mapper';

export class PgImageRepositoryImpl
  extends PgRepositoryImpl<PgImageEntity, NestStorage.Image, NestStorage.ImageQuery, ImageCreate>
  implements ImageRepository
{
  constructor(
    @InjectRepository(PgImageEntity) protected readonly repository: EntityRepository<PgImageEntity>,
  ) {
    super(repository, new PgImageMapper());
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
          const storageObjectEntity = em.create(
            PgStorageObjectEntity,
            buildLeafStorageObject({
              meta: createData.storageObject,
              userId: fileEntity.userId,
              type: NestStorage.StorageObjectType.IMAGE,
              fileId: fileEntity.id,
              imageId: imageEntity.id,
            }),
          );

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
            const storageObjectEntity = em.create(
              PgStorageObjectEntity,
              buildLeafStorageObject({
                meta: item.storageObject,
                userId: fileEntity.userId,
                type: NestStorage.StorageObjectType.IMAGE,
                fileId: fileEntity.id,
                imageId: imageEntity.id,
              }),
            );

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

  // The image hangs off its file row, not the other way round: `images.file_id` cascades from
  // `files`, so deleting the image alone left the file row behind — for good once it was READY,
  // since the cleanup cron sweeps PENDING/FAILED only. Both go in one flush (the image first, as
  // the FK owner); the storage object follows through the database cascade.
  async deleteWithFile(id: string): Promise<Either<NotFoundException, NestStorage.Image>> {
    try {
      const image = await this.repository.findOne({ id });

      if (!image) {
        return left(new NotFoundException(`${this.repository.getEntityName()} not found`));
      }

      const file = this.em.getReference(PgFileEntity, image.file.id);
      await this.em.remove([image, file]).flush();

      return right(this.mapper.stringify(image));
    } catch (error) {
      return left(error as NotFoundException);
    }
  }
}
