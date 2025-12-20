import { BaseQuery, DatabaseEntity } from '@backend/common';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { DatabaseRepository } from 'common';
import { MongoMapper } from 'modules/mongo/mappers';
import { MongoEntity } from 'modules/mongo/mongo.entity';
import { Model } from 'mongoose';

export abstract class MongoRepositoryImpl<
  Doc extends MongoEntity,
  Entity extends DatabaseEntity = DatabaseEntity,
  Query extends BaseQuery = BaseQuery & Partial<Entity>,
  Create = Partial<Omit<Entity, 'createdAt' | 'updatedAt'>>,
  Update = Partial<Entity>,
  // @ts-ignore
> implements DatabaseRepository<Entity, Query, Create, Update>
{
  protected constructor(
    protected readonly model: Model<Doc>,
    protected readonly mapper: MongoMapper<Entity, Doc, Query>,
  ) {}

  async isExistsById(id: string): Promise<boolean> {
    return this.isExists({ id } as Query);
  }

  async isExists(query: Query = {} as Query): Promise<boolean> {
    const result = await this.model.exists(this.mapper.transformQuery(query));
    return !!result?._id;
  }

  async count(query: Query = {} as Query): Promise<number> {
    return this.model.countDocuments(this.mapper.transformQuery(query));
  }

  async getById(id: string): Promise<Either<NotFoundException, Entity>> {
    return this.getOne({ id } as Query);
  }

  async getOne(query: Query = {} as Query): Promise<Either<NotFoundException, Entity>> {
    const entity = await this.model.findOne(this.mapper.transformQuery(query)).lean();

    if (!entity) {
      return left(new NotFoundException(this.model.modelName));
    }

    return right(entity as Entity);
  }

  async getMany(query: Query = {} as Query): Promise<Entity[]> {
    return this.model.find(this.mapper.transformQuery(query)).lean() as unknown as Entity[];
  }

  async saveOne(createData: Create): Promise<Either<InternalServerErrorException, Entity>> {
    try {
      const entity = await this.model.create(createData as any);
      return right(this.mapper.stringify(entity as unknown as Doc));
    } catch (e) {
      return left(new InternalServerErrorException(e?.['message']));
    }
  }

  async saveMany(createData: Create[]): Promise<Either<InternalServerErrorException, Entity[]>> {
    try {
      const entities = await this.model.insertMany(createData);
      return right(this.mapper.stringifyMany(entities as any));
    } catch (e) {
      return left(new InternalServerErrorException(e?.['message']));
    }
  }

  async deleteById(id: string): Promise<boolean> {
    return this.deleteOne({ id } as Query);
  }

  async deleteMany(query: Query = {} as Query): Promise<boolean> {
    const result = await this.model.deleteMany(this.mapper.transformQuery(query));
    return !!result.deletedCount;
  }

  async deleteOne(query: Query = {} as Query): Promise<boolean> {
    const result = await this.model.deleteOne(this.mapper.transformQuery(query));
    return !!result.deletedCount;
  }

  async updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>> {
    return this.updateOne({ id } as Query, updateData);
  }

  async updateMany(query: Query, updateData: Update): Promise<boolean> {
    const result = await this.model.updateMany(this.mapper.transformQuery(query), {
      $set: updateData,
    });
    return !!result.modifiedCount;
  }

  async updateOne(query: Query, updateData: Update): Promise<Either<NotFoundException, Entity>> {
    const entity = await this.model
      .findByIdAndUpdate(this.mapper.transformQuery(query), { $set: updateData }, { new: true })
      .lean();

    if (!entity) {
      return left(new NotFoundException(this.model.modelName));
    }

    return right(entity as Entity);
  }
}
