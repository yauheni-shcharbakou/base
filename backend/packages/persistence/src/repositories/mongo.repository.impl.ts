import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { BaseQuery, IdField } from '@backend/grpc';
import { Either, left, right } from '@sweet-monads/either';
import { MongoEntity } from 'entities';
import {
  CreateOf,
  DatabaseRepository,
  DatabaseRepositoryGetList,
  DatabaseRepositoryGetListRes,
  UpdateOf,
} from 'interfaces';
import { MongoMapper } from 'mappers';
import { Model } from 'mongoose';

export abstract class MongoRepositoryImpl<
  Doc extends MongoEntity,
  Entity extends IdField = IdField,
  Query extends BaseQuery = BaseQuery & Partial<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
> implements DatabaseRepository<Entity, Query, Create, Update> {
  protected constructor(
    protected readonly model: Model<Doc>,
    protected readonly mapper: MongoMapper<Entity, Doc, Query> = new MongoMapper(),
  ) {}

  async isExistsById(id: string): Promise<boolean> {
    return this.isExists({ id } as Partial<Query>);
  }

  async isExists(query: Partial<Query> = {}): Promise<boolean> {
    const result = await this.model.exists(this.mapper.transformQuery(query)).exec();
    return !!result?._id;
  }

  async count(query: Partial<Query> = {}): Promise<number> {
    return this.model.countDocuments(this.mapper.transformQuery(query));
  }

  async getById(id: string): Promise<Either<NotFoundException, Entity>> {
    return this.getOne({ id } as Partial<Query>);
  }

  async getOne(query: Partial<Query> = {}): Promise<Either<NotFoundException, Entity>> {
    const entity = await this.model.findOne<Doc>(this.mapper.transformQuery(query)).exec();

    if (!entity) {
      return left(new NotFoundException(`${this.model.modelName} not found`));
    }

    return right(this.mapper.stringify(entity));
  }

  async getMany(query: Partial<Query> = {}): Promise<Entity[]> {
    const entities = await this.model.find<Doc>(this.mapper.transformQuery(query)).exec();
    return this.mapper.stringifyMany(entities);
  }

  async getList(
    request: DatabaseRepositoryGetList<Query>,
  ): Promise<DatabaseRepositoryGetListRes<Entity>> {
    try {
      const query = this.mapper.transformListQuery(request);
      const sort = this.mapper.transformSorters(request.sorters);

      const page = request.pagination?.page || 1;
      const limit = request.pagination?.limit || 100;
      const skip = (page - 1) * limit;

      const [total, entities] = await Promise.all([
        this.model.countDocuments(query),
        this.model.find<Doc>(query).limit(limit).skip(skip).sort(sort).exec(),
      ]);

      return {
        items: this.mapper.stringifyMany(entities),
        total,
      };
    } catch (error) {
      return { items: [], total: 0 };
    }
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
      const entities = await this.model.insertMany<any>(createData);
      return right(this.mapper.stringifyMany(entities));
    } catch (e) {
      return left(new InternalServerErrorException(e?.['message']));
    }
  }

  async deleteById(id: string): Promise<Either<NotFoundException, Entity>> {
    return this.deleteOne({ id } as Partial<Query>);
  }

  async deleteMany(query: Partial<Query> = {}): Promise<boolean> {
    const result = await this.model.deleteMany(this.mapper.transformQuery(query)).exec();
    return !!result.deletedCount;
  }

  async deleteOne(query: Partial<Query> = {}): Promise<Either<NotFoundException, Entity>> {
    const entity = await this.model.findOneAndDelete<Doc>(this.mapper.transformQuery(query)).exec();

    if (!entity) {
      return left(new NotFoundException(`${this.model.modelName} not found`));
    }

    return right(this.mapper.stringify(entity));
  }

  async updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>> {
    return this.updateOne({ id } as Partial<Query>, updateData);
  }

  async updateMany(query: Partial<Query>, updateData: Update): Promise<boolean> {
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
