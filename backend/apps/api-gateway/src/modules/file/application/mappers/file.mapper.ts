import { NestStorage } from '@backend/proto';
import { QueryMapper } from '@common/application/mapper/query.mapper';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FileMapper extends QueryMapper<NestStorage.FileQuery> {
  protected getBaseQuery(): NestStorage.FileQuery {
    return {
      ...super.getBaseQuery(),
      userIds: [],
      mimeTypes: [],
      uploadStatuses: [],
    };
  }
}
