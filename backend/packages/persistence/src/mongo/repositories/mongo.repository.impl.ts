import { NotFoundException } from '@nestjs/common';
import { GrpcEntityWithTimestamps } from '@backend/grpc';
import { Either, left, right } from '@sweet-monads/either';
import { MongoEntity } from 'mongo/entities';
import {
  CreateOf,
  DatabaseRepository,
  DatabaseRepositoryGetList,
  DatabaseRepositoryGetListRes,
  UpdateOf,
  OptionsOf,
  QueryOf,
} from 'common';
import { MongoMapper } from 'mongo/mappers';
import { Model } from 'mongoose';

export abstract class MongoRepositoryImpl<
  Doc extends MongoEntity,
  Entity extends GrpcEntityWithTimestamps = GrpcEntityWithTimestamps,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
  Options extends OptionsOf<Entity> = OptionsOf<Entity>,
> implements DatabaseRepository<Entity, Query, Create, Update> {
  protected constructor(
    protected readonly model: Model<Doc>,
    protected readonly mapper: MongoMapper<Entity, Doc, Query> = new MongoMapper(),
  ) {}

  async isExistsById(id: string, options: Partial<Options> = {}): Promise<boolean> {
    return this.isExists({ id } as Partial<Query>, options);
  }

  async isExists(query: Partial<Query> = {}, options: Partial<Options> = {}): Promise<boolean> {
    const result = await this.model.exists(this.mapper.transformQuery(query)).exec();
    return !!result?._id;
  }

  async count(query: Partial<Query> = {}, options: Partial<Options> = {}): Promise<number> {
    return this.model.countDocuments(this.mapper.transformQuery(query));
  }

  async getById(
    id: string,
    options: Partial<Options> = {},
  ): Promise<Either<NotFoundException, Entity>> {
    return this.getOne({ id } as Partial<Query>, options);
  }

  async getOne(
    query: Partial<Query> = {},
    options: Partial<Options> = {},
  ): Promise<Either<NotFoundException, Entity>> {
    const entity = await this.model.findOne<Doc>(this.mapper.transformQuery(query)).exec();

    if (!entity) {
      return left(new NotFoundException(`${this.model.modelName} not found`));
    }

    return right(this.mapper.stringify(entity));
  }

  async getMany(query: Partial<Query> = {}, options: Partial<Options> = {}): Promise<Entity[]> {
    const entities = await this.model.find<Doc>(this.mapper.transformQuery(query)).exec();
    return this.mapper.stringifyMany(entities);
  }

  async getList<E = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    options: Partial<Options> = {},
  ): Promise<DatabaseRepositoryGetListRes<E>> {
    try {
      const query = this.mapper.transformListQuery(request);
      const sort = this.mapper.transformSorters(request.sorters);

      const page = request.pagination?.page || 1;
      const limit = request.pagination?.limit || 100;
      const skip = (page - 1) * limit;

      const [total, entities] = await Promise.all([
        this.model.countDocuments(query),
        this.model
          .find<Doc>(query)
          .populate((options.populate as unknown as string[]) ?? [])
          .limit(limit)
          .skip(skip)
          .sort(sort)
          .exec(),
      ]);

      return {
        items: this.mapper.stringifyMany(entities) as unknown as E[],
        total,
      };
    } catch (error) {
      return { items: [], total: 0 };
    }
  }

  async saveOne(
    createData: Create,
    options: Partial<Options> = {},
  ): Promise<Either<Error, Entity>> {
    try {
      const entity = await this.model.create(createData as any);
      return right(this.mapper.stringify(entity as unknown as Doc));
    } catch (error) {
      return left(error as Error);
    }
  }

  async saveMany(
    createData: Create[],
    options: Partial<Options> = {},
  ): Promise<Either<Error, Entity[]>> {
    try {
      const entities = await this.model.insertMany<any>(createData);
      return right(this.mapper.stringifyMany(entities));
    } catch (error) {
      return left(error as Error);
    }
  }

  async deleteById(
    id: string,
    options: Partial<Options> = {},
  ): Promise<Either<NotFoundException, Entity>> {
    return this.deleteOne({ id } as Partial<Query>, options);
  }

  async deleteMany(query: Partial<Query> = {}, options: Partial<Options> = {}): Promise<boolean> {
    const result = await this.model.deleteMany(this.mapper.transformQuery(query)).exec();
    return !!result.deletedCount;
  }

  async deleteOne(
    query: Partial<Query> = {},
    options: Partial<Options> = {},
  ): Promise<Either<NotFoundException, Entity>> {
    const entity = await this.model.findOneAndDelete<Doc>(this.mapper.transformQuery(query)).exec();

    if (!entity) {
      return left(new NotFoundException(`${this.model.modelName} not found`));
    }

    return right(this.mapper.stringify(entity));
  }

  async updateById(
    id: string,
    updateData: Update,
    options: Partial<Options> = {},
  ): Promise<Either<NotFoundException, Entity>> {
    return this.updateOne({ id } as Partial<Query>, updateData, options);
  }

  async updateMany(
    query: Partial<Query>,
    updateData: Update,
    options: Partial<Options> = {},
  ): Promise<boolean> {
    const result = await this.model
      .updateMany(this.mapper.transformQuery(query), {
        $set: updateData['set'] ?? {},
        $unset: updateData['remove'] ?? {},
        $inc: updateData['inc'] ?? {},
      })
      .exec();

    return !!result.modifiedCount;
  }

  async updateOne(
    query: Partial<Query>,
    updateData: Update,
    options: Partial<Options> = {},
  ): Promise<Either<NotFoundException, Entity>> {
    const entity = await this.model
      .findByIdAndUpdate<Doc>(
        this.mapper.transformQuery(query),
        {
          $set: updateData['set'] ?? {},
          $unset: updateData['remove'] ?? {},
          $inc: updateData['inc'] ?? {},
        },
        { new: true },
      )
      .exec();

    if (!entity) {
      return left(new NotFoundException(`${this.model.modelName} not found`));
    }

    return right(this.mapper.stringify(entity));
  }
}
