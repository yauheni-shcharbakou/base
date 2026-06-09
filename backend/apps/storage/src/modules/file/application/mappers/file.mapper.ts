import { NestStorage } from '@backend/proto';
import { Injectable } from '@nestjs/common';
import { extname } from 'path';

type FileCreateData<Create extends Pick<NestStorage.File, 'originalName'>> = Create &
  Pick<NestStorage.File, 'uploadStatus' | 'extension'>;

@Injectable()
export class FileMapper {
  private getExtension(originalName: string): string {
    return extname(originalName).replace(/^./g, '');
  }

  toCreateData<File extends Pick<NestStorage.File, 'originalName'>>(
    data: File,
  ): FileCreateData<File> {
    return {
      ...data,
      extension: this.getExtension(data.originalName),
      uploadStatus: NestStorage.FileUploadStatus.PENDING,
    };
  }
}
