import { GetUseCase } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FileGetUseCase extends GetUseCase<NestStorage.File, NestStorage.FileQuery> {
  constructor(protected readonly repository: FileRepository) {
    super(repository);
  }
}
