import { NestStorage } from '@backend/proto';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { FileRepository, FileWithMedia } from '@modules/file/domain/repositories/file.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

@Injectable()
export class FileDeleteUseCase {
  constructor(
    private readonly repository: FileRepository,
    private readonly filePurgeService: FilePurgeService,
  ) {}

  // The media relations are read before the delete: a file backing a video or an image takes that
  // row with it through the cascade, and the video's `providerId` is the only way to its Bunny
  // Stream object, the image's `previewProviderId` the only way to its preview. Not gated on READY — with a direct upload the bytes can land before `completeUpload`.
  async deleteOne(
    query: Partial<NestStorage.FileQuery>,
  ): Promise<Either<NotFoundException, NestStorage.File>> {
    const file = await this.repository.getOne<FileWithMedia>(query, {
      populate: ['video', 'image'],
    });

    if (file.isLeft()) {
      return file;
    }

    const deleted = await this.repository.deleteById(file.value.id);

    if (deleted.isRight()) {
      await this.filePurgeService.purgeFiles([file.value]);
    }

    return deleted;
  }
}
