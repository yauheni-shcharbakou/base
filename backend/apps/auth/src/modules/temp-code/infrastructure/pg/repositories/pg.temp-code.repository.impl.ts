import { PgRepositoryImpl } from '@backend/pg';
import { NestAuth } from '@backend/proto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import {
  TempCodeCreate,
  TempCodeQuery,
  TempCodeRepository,
} from '@modules/temp-code/domain/repositories/temp-code.repository';
import { PgTempCodeEntity } from '../entities/pg.temp-code.entity';
import { PgTempCodeMapper } from '../mappers/pg.temp-code.mapper';

export class PgTempCodeRepositoryImpl
  extends PgRepositoryImpl<PgTempCodeEntity, NestAuth.TempCode, TempCodeQuery, TempCodeCreate>
  implements TempCodeRepository
{
  constructor(
    @InjectRepository(PgTempCodeEntity)
    protected readonly repository: EntityRepository<PgTempCodeEntity>,
  ) {
    super(repository, new PgTempCodeMapper());
  }
}
