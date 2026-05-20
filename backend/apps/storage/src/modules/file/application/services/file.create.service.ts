import { CreateOf } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { Injectable } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import _ from 'lodash';
import { extname } from 'path';

export interface FileCreate extends Omit<
  CreateOf<NestStorage.File>,
  'extension' | 'uploadStatus'
> {}

@Injectable()
export class FileCreateService {
  constructor(private readonly fileRepository: FileRepository) {}

  private getExtension(originalName: string): string {
    return extname(originalName).replace(/^./g, '');
  }

  createOne(createData: FileCreate): Promise<Either<Error, NestStorage.File>> {
    return this.fileRepository.saveOne({
      ...createData,
      extension: this.getExtension(createData.originalName),
      uploadStatus: NestStorage.FileUploadStatus.PENDING,
    });
  }

  createMany(createData: FileCreate[]): Promise<Either<Error, NestStorage.File[]>> {
    return this.fileRepository.saveMany(
      _.map(createData, (item) => {
        return {
          ...item,
          extension: this.getExtension(item.originalName),
          uploadStatus: NestStorage.FileUploadStatus.PENDING,
        };
      }),
    );
  }
}
