import { PgRepositoryImpl } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { PgFileEntity } from '../entities/pg.file.entity';
import { PgFileMapper } from '../mappers/pg.file.mapper';

export class PgFileRepositoryImpl
  extends PgRepositoryImpl<PgFileEntity, NestStorage.File, NestStorage.FileQuery>
  implements FileRepository
{
  constructor(
    @InjectRepository(PgFileEntity) protected readonly repository: EntityRepository<PgFileEntity>,
  ) {
    super(repository, new PgFileMapper());
  }
}
