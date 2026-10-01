import { DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { FileMeta } from '@common/domain/interfaces/file.meta.interface';
import { StorageObjectPlacementMeta } from '@common/domain/interfaces/storage-object.meta.interface';
import { NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

export interface ImageCreate extends NestStorage.ImageCreate {
  file: string;
  userId: string;
}

export interface ImageSaveAndPlace {
  image: Omit<ImageCreate, 'file'>;
  file: FileMeta;
  storageObject?: StorageObjectPlacementMeta;
}

export abstract class ImageRepository extends DatabaseRepository<
  NestStorage.Image,
  NestStorage.ImageQuery,
  ImageCreate
> {
  abstract saveAndPlaceOne(
    createData: ImageSaveAndPlace,
  ): Promise<Either<Error, NestStorage.Image>>;
  abstract saveAndPlaceMany(
    items: ImageSaveAndPlace[],
  ): Promise<Either<Error, NestStorage.Image[]>>;
  /** Deletes the image together with the file row it owns — see the implementation for why. */
  abstract deleteWithFile(id: string): Promise<Either<NotFoundException, NestStorage.Image>>;
  /**
   * READY images the preview step has neither finished nor given up on, whose file turned READY
   * before `readyBefore`, oldest first, with their file — past `afterId` when one is given, which
   * is how a sweep goes on from its last batch. Throws on a failed read.
   */
  abstract getManyWithoutPreview(
    readyBefore: Date,
    limit: number,
    afterId?: string,
  ): Promise<NestStorage.ImagePopulated[]>;
  /**
   * Records the preview key, unless one is already set. `false` when no row took it: the image is
   * gone, or another run got there first.
   */
  abstract setPreview(id: string, previewProviderId: string): Promise<Either<Error, boolean>>;
  /** Marks the preview as impossible, unless one is already set; `false` as for `setPreview`. */
  abstract markPreviewFailed(id: string): Promise<Either<Error, boolean>>;
  /**
   * Counts a sweep that came back from the image without a preview, and marks it failed once that
   * makes `maxAttempts` — in one statement, and only over neither a preview nor a mark. `true` when
   * this call gave up on it.
   */
  abstract countPreviewAttempt(id: string, maxAttempts: number): Promise<Either<Error, boolean>>;
}
