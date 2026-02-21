import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { GrpcBaseQuery, GrpcGetListRequest, GrpcIdField } from '@backend/grpc';
import { Either } from '@sweet-monads/either';

export type ExcludeDatabaseSystemFields<Entity> = Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>;

export type CreateOf<Entity> = ExcludeDatabaseSystemFields<Entity>;

export type UpdateSetOf<Entity> = Partial<ExcludeDatabaseSystemFields<Entity>>;

export type UpdateRemoveOf<Entity> = (keyof UpdateSetOf<Entity>)[];

export type UpdateIncOf<Entity> = {
  [Field in keyof UpdateSetOf<Entity> as Entity[Field] extends number
    ? Field
    : never]?: Entity[Field];
};

export type UpdateOf<Entity> = {
  set?: UpdateSetOf<Entity>;
  remove?: UpdateRemoveOf<Entity>;
  inc?: UpdateIncOf<Entity>;
};

export interface DatabaseRepositoryGetList<Query> extends Partial<GrpcGetListRequest> {
  query?: Partial<Query>;
}

export interface DatabaseRepositoryGetListRes<Entity> {
  items: Entity[];
  total: number;
}

export interface DatabaseRepository<
  Entity extends GrpcIdField = GrpcIdField,
  Query extends GrpcBaseQuery = GrpcBaseQuery & Partial<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
> {
  isExistsById(id: string): Promise<boolean>;
  isExists(query?: Partial<Query>): Promise<boolean>;
  count(query?: Partial<Query>): Promise<number>;
  getById(id: string): Promise<Either<NotFoundException, Entity>>;
  getOne(query?: Partial<Query>): Promise<Either<NotFoundException, Entity>>;
  getMany(query?: Partial<Query>): Promise<Entity[]>;
  getList(request: DatabaseRepositoryGetList<Query>): Promise<DatabaseRepositoryGetListRes<Entity>>;
  saveOne(createData: Create): Promise<Either<InternalServerErrorException, Entity>>;
  saveMany(createData: Create[]): Promise<Either<InternalServerErrorException, Entity[]>>;
  updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>>;
  updateOne(query: Partial<Query>, updateData: Update): Promise<Either<NotFoundException, Entity>>;
  updateMany(query: Partial<Query>, updateData: Update): Promise<boolean>;
  deleteById(id: string): Promise<Either<NotFoundException, Entity>>;
  deleteOne(query?: Partial<Query>): Promise<Either<NotFoundException, Entity>>;
  deleteMany(query?: Partial<Query>): Promise<boolean>;
}
