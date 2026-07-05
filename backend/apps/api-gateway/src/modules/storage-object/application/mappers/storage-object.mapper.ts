import { NestStorage } from '@backend/proto';
import { QueryMapper } from '@common/application/mapper/query.mapper';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageObjectMapper extends QueryMapper<NestStorage.StorageObjectQuery> {}
