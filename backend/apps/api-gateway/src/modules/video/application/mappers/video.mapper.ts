import { NestStorage } from '@backend/proto';
import { QueryMapper } from '@common/application/mapper/query.mapper';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VideoMapper extends QueryMapper<NestStorage.VideoQuery> {
  protected getBaseQuery(): NestStorage.VideoQuery {
    return {
      ...super.getBaseQuery(),
      providerIds: [],
    };
  }
}
