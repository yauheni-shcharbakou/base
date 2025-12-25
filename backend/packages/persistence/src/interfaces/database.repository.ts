import { BaseQuery, DatabaseEntity } from '@backend/common';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

export interface DatabaseRepository<
  Entity extends DatabaseEntity = DatabaseEntity,
  Query extends BaseQuery = BaseQuery & Partial<Entity>,
  Create = Omit<Entity, '_id' | 'createdAt' | 'updatedAt'>,
  Update = Partial<Entity>,
> {
  isExistsById(id: string): Promise<boolean>;
  isExists(query?: Query): Promise<boolean>;
  count(query?: Query): Promise<number>;
  getById(id: string): Promise<Either<NotFoundException, Entity>>;
  getOne(query?: Query): Promise<Either<NotFoundException, Entity>>;
  getMany(query?: Query): Promise<Entity[]>;
  saveOne(createData: Create): Promise<Either<InternalServerErrorException, Entity>>;
  saveMany(createData: Create[]): Promise<Either<InternalServerErrorException, Entity[]>>;
  updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>>;
  updateOne(query: Query, updateData: Update): Promise<Either<NotFoundException, Entity>>;
  updateMany(query: Query, updateData: Update): Promise<boolean>;
  deleteById(id: string): Promise<boolean>;
  deleteOne(query?: Query): Promise<boolean>;
  deleteMany(query?: Query): Promise<boolean>;
}
