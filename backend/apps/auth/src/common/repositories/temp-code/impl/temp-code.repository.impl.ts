import { PostgresRepositoryImpl } from '@backend/persistence';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { GrpcTempCode } from '@backend/grpc';
import { TempCodeEntity } from 'common/repositories/temp-code/entities/temp-code.entity';
import { TempCodeMapper } from 'common/repositories/temp-code/mappers/temp-code.mapper';
import {
  TempCodeCreate,
  TempCodeQuery,
  TempCodeRepository,
} from 'common/repositories/temp-code/temp-code.repository';

export class TempCodeRepositoryImpl
  extends PostgresRepositoryImpl<TempCodeEntity, GrpcTempCode, TempCodeQuery, TempCodeCreate>
  implements TempCodeRepository
{
  constructor(
    @InjectRepository(TempCodeEntity)
    protected readonly repository: EntityRepository<TempCodeEntity>,
  ) {
    super(repository, new TempCodeMapper());
  }
}
