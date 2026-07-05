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
import { Either, left, right } from '@sweet-monads/either';
import { PgVideoMapper } from '../mappers/pg.video.mapper';

export class PgVideoRepositoryImpl
  extends PgRepositoryImpl<PgVideoEntity, NestStorage.Video, NestStorage.VideoQuery, VideoCreate>
  implements VideoRepository
{
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
}
