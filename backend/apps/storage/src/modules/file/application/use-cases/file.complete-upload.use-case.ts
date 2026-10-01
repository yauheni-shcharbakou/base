import { NestStorage } from '@backend/proto';
import { FileCompletionService } from '@modules/file/application/services/file.completion.service';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';

/** Completes one directly uploaded file — see `FileCompletionService`. */
@Injectable()
export class FileCompleteUploadUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly fileCompletionService: FileCompletionService,
  ) {}

  async execute({
    id,
    userId,
  }: NestStorage.FileCompleteUpload): Promise<Either<Error, NestStorage.File>> {
    const file = await this.fileRepository.getOne({ id, userId });

    if (file.isLeft()) {
      return left(file.value);
    }

    return this.fileCompletionService.complete(file.value);
  }
}
