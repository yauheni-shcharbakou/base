import { PgRepositoryImpl } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { buildLeafStorageObject } from '@common/infrastructure/pg/factories/pg.storage-object.factory';
import { FilterQuery } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  ImageCreate,
  ImageRepository,
  ImageSaveAndPlace,
} from '@modules/image/domain/repositories/image.repository';
import { NotFoundException } from '@nestjs/common';
import { StorageDatabaseEntity } from '@packages/common';
import { Either, left, right } from '@sweet-monads/either';
import { PgImageMapper } from '../mappers/pg.image.mapper';

export class PgImageRepositoryImpl
  extends PgRepositoryImpl<PgImageEntity, NestStorage.Image, NestStorage.ImageQuery, ImageCreate>
  implements ImageRepository
{
  protected readonly resourceName = 'Image';

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
        return left(this.notFound());
      }

      const file = this.em.getReference(PgFileEntity, image.file.id);
      await this.em.remove([image, file]).flush();

      return right(this.mapper.stringify(image));
    } catch (error) {
      return left(error as NotFoundException);
    }
  }

  async getManyWithoutPreview(
    readyBefore: Date,
    limit: number,
    afterId?: string,
  ): Promise<NestStorage.ImagePopulated[]> {
    try {
      const images = await this.repository.find(
        {
          ...(afterId && { id: { $gt: afterId } }),
          previewProviderId: null,
          previewFailedAt: null,
          file: {
            uploadStatus: NestStorage.FileUploadStatus.READY,
            updatedAt: { $lt: readyBefore },
          },
        },
        { populate: ['file'], orderBy: { id: 'asc' }, limit },
      );

      return this.mapper.stringifyMany(images) as NestStorage.ImagePopulated[];
    } catch (error) {
      throw this.toFailure('read previewless', error);
    }
  }

  // Straight to the table, conditional on no key yet: the event handler and the sweep can race on
  // one image, and the row may be deleted under either. Neither must overwrite what the other set.
  async setPreview(id: string, previewProviderId: string): Promise<Either<Error, boolean>> {
    return this.updateWithoutPreview(id, { previewProviderId });
  }

  async markPreviewFailed(id: string): Promise<Either<Error, boolean>> {
    return this.updateWithoutPreview(id, { previewFailedAt: new Date() });
  }

  // The count and the mark it may bring are one statement, so two sweeps counting the same image
  // cannot both read the old count. `set` reads the row as it was, hence the `+ 1` in the `case`.
  async countPreviewAttempt(id: string, maxAttempts: number): Promise<Either<Error, boolean>> {
    const sql = `
      UPDATE "${StorageDatabaseEntity.IMAGE}"
      SET preview_attempts = preview_attempts + 1,
          preview_failed_at = CASE WHEN preview_attempts + 1 >= ? THEN now() END
      WHERE id = ? AND preview_provider_id IS NULL AND preview_failed_at IS NULL
      RETURNING preview_failed_at
    `;

    try {
      const [row] = await this.em.execute<{ preview_failed_at: Date | null }[]>(sql, [
        maxAttempts,
        id,
      ]);

      return right(!!row?.preview_failed_at);
    } catch (error) {
      return left(error as Error);
    }
  }

  private async updateWithoutPreview(
    id: string,
    set: Partial<Pick<PgImageEntity, 'previewProviderId' | 'previewFailedAt'>>,
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
