import { DatabaseRepository, QueryOf } from '@/database/domain';
import { NestCommon } from '@backend/proto';

export abstract class IsExistsUseCase<
  Query extends QueryOf<NestCommon.Entity> = QueryOf<NestCommon.Entity>,
  Repository extends DatabaseRepository<any, Query> = DatabaseRepository<any, Query>,
> {
  constructor(protected readonly repository: Repository) {}

  isExists(query: Partial<Query>): Promise<boolean> {
    return this.repository.isExists(query);
  }

  isExistsById(id: string): Promise<boolean> {
    return this.repository.isExistsById(id);
  }
}
