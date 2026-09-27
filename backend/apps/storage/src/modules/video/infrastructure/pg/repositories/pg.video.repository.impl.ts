import { PgRepositoryImpl } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import { buildLeafStorageObject } from '@common/infrastructure/pg/factories/pg.storage-object.factory';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  VideoCreate,
  VideoRepository,
  VideoSaveAndPlace,
} from '@modules/video/domain/repositories/video.repository';
import { NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { PgVideoMapper } from '../mappers/pg.video.mapper';

export class PgVideoRepositoryImpl
  extends PgRepositoryImpl<PgVideoEntity, NestStorage.Video, NestStorage.VideoQuery, VideoCreate>
  implements VideoRepository
{
  protected readonly resourceName = 'Video';

  constructor(
    @InjectRepository(PgVideoEntity) protected readonly repository: EntityRepository<PgVideoEntity>,
  ) {
    super(repository, new PgVideoMapper());
  }

  async saveAndPlaceOne(createData: VideoSaveAndPlace): Promise<Either<Error, NestStorage.Video>> {
    try {
      const video = await this.em.transactional(async (em) => {
        const fileEntity = em.create(PgFileEntity, {
          ...createData.file,
          userId: createData.video.userId,
          uploadId: createData.video.uploadId,
        });

        const videoEntity = em.create(PgVideoEntity, {
          ...createData.video,
          file: fileEntity.id,
        });

        em.persist([fileEntity, videoEntity]);

        if (createData.storageObject) {
          const storageObjectEntity = em.create(
            PgStorageObjectEntity,
            buildLeafStorageObject({
              meta: createData.storageObject,
              userId: fileEntity.userId,
              type: NestStorage.StorageObjectType.VIDEO,
              fileId: fileEntity.id,
              videoId: videoEntity.id,
            }),
          );

          em.persist(storageObjectEntity);
        }

        await em.flush();
        return this.mapper.stringify(videoEntity);
      });

      return right(video);
    } catch (error) {
      return left(error);
    }
  }

  async saveAndPlaceMany(items: VideoSaveAndPlace[]): Promise<Either<Error, NestStorage.Video[]>> {
    try {
      const videos = await this.em.transactional(async (em) => {
        const videoEntities: PgVideoEntity[] = [];

        for (const item of items) {
          const fileEntity = em.create(PgFileEntity, {
            ...item.file,
            userId: item.video.userId,
            uploadId: item.video.uploadId,
          });

          const videoEntity = em.create(PgVideoEntity, {
            ...item.video,
            file: fileEntity.id,
          });

          em.persist([fileEntity, videoEntity]);
          videoEntities.push(videoEntity);

          if (item.storageObject) {
            const storageObjectEntity = em.create(
              PgStorageObjectEntity,
              buildLeafStorageObject({
                meta: item.storageObject,
                userId: fileEntity.userId,
                type: NestStorage.StorageObjectType.VIDEO,
                fileId: fileEntity.id,
                videoId: videoEntity.id,
              }),
            );

            em.persist(storageObjectEntity);
          }
        }

        await em.flush();
        return this.mapper.stringifyMany(videoEntities);
      });

      return right(videos);
    } catch (error) {
      return left(error);
    }
  }

  // The video hangs off its file row, not the other way round: `videos.file_id` cascades from
  // `files`, so deleting the video alone left the file row behind — for good once it was READY,
  // since the cleanup cron sweeps PENDING/FAILED only. Both go in one flush (the video first, as
  // the FK owner); the storage object follows through the database cascade.
  async deleteWithFile(id: string): Promise<Either<NotFoundException, NestStorage.Video>> {
    try {
      const video = await this.repository.findOne({ id });

      if (!video) {
        return left(this.notFound());
      }

      const file = this.em.getReference(PgFileEntity, video.file.id);
      await this.em.remove([video, file]).flush();

      return right(this.mapper.stringify(video));
    } catch (error) {
      return left(error as NotFoundException);
    }
  }
}
