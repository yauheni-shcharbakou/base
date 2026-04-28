import { NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { MongoEntity } from 'mongo/entities';
import {
  CreateOf,
  DatabaseRepository,
  DatabaseRepositoryGetList,
  DatabaseRepositoryGetListRes,
  UpdateOf,
  OptionsOf,
  QueryOf,
  BulkUpdate,
} from 'common';
import { MongoMapper } from 'mongo/mappers';
import { Model } from 'mongoose';
import type { NestCommon } from '@backend/proto';

export abstract class MongoRepositoryImpl<
  Doc extends MongoEntity,
  Entity extends NestCommon.EntityWithTimestamps = NestCommon.EntityWithTimestamps,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
> implements DatabaseRepository<Entity, Query, Create, Update> {
  protected constructor(
    protected readonly model: Model<Doc>,
    protected readonly mapper: MongoMapper<Doc, Entity, Query> = new MongoMapper(),
  ) {}

  private getPopulate<E extends NestCommon.EntityWithTimestamps = Entity>(
    options: OptionsOf<E> = {},
  ) {
    if (!options.populate) {
      return undefined;
    }

    return _.map(options.populate, (populateField) => populateField.toString());
  }

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

  async distinct<Field extends keyof Entity>(
    field: Field,
    query?: Partial<Query>,
  ): Promise<Set<Entity[Field]>> {
    try {
      const transformedQuery = this.mapper.transformQuery(query);

      const values = (await this.model
        .distinct(field.toString(), transformedQuery, { limit: 1_000 })
        .exec()) as Entity[Field][];

      return _.reduce(
        values,
        (acc: Set<Entity[Field]>, value: Entity[Field]) => {
          if (!_.isNil(value)) {
            acc.add(value);
          }

          return acc;
        },
        new Set(),
      );
    } catch (e) {
      return new Set();
    }
  }

  async getById<E extends NestCommon.EntityWithTimestamps = Entity>(
    id: string,
    options: OptionsOf<E> = {},
  ): Promise<Either<NotFoundException, E>> {
    return this.getOne({ id } as Partial<Query>, options);
  }

  async getOne<E extends NestCommon.EntityWithTimestamps = Entity>(
    query: Partial<Query> = {},
    options: OptionsOf<E> = {},
  ): Promise<Either<NotFoundException, E>> {
    const entity = await this.model
      .findOne<Doc>(this.mapper.transformQuery(query), null, {
        populate: this.getPopulate(options),
      })
      .exec();

    if (!entity) {
      return left(new NotFoundException(`${this.model.modelName} not found`));
    }

    return right(this.mapper.stringify(entity) as unknown as E);
  }

  async getMany<E extends NestCommon.EntityWithTimestamps = Entity>(
    query: Partial<Query> = {},
    options: OptionsOf<E> = {},
  ): Promise<E[]> {
    const entities = await this.model
      .find<Doc>(this.mapper.transformQuery(query), null, { populate: this.getPopulate(options) })
      .exec();

    return this.mapper.stringifyMany(entities) as unknown as E[];
  }

  async getList<E extends NestCommon.EntityWithTimestamps = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    options: OptionsOf<E> = {},
  ): Promise<DatabaseRepositoryGetListRes<E>> {
    try {
      const query = this.mapper.transformListQuery(request);
      const sort = this.mapper.transformSorters(request.sorters);
      const populate = this.getPopulate(options);

      const page = request.pagination?.page || 1;
      const limit = request.pagination?.limit || 100;
      const skip = (page - 1) * limit;

      const entityQuery = this.model.find<Doc>(query).limit(limit).skip(skip);

      if (populate) {
        entityQuery.populate(populate);
      }

      if (!_.isEmpty(sort)) {
        entityQuery.sort(sort);
      }

      const [total, entities] = await Promise.all([
        this.model.countDocuments(query),
        entityQuery.exec(),
      ]);

      return {
        items: this.mapper.stringifyMany(entities) as unknown as E[],
        total,
      };
    } catch (error) {
      return { items: [], total: 0 };
    }
  }

  async saveOne(createData: Create): Promise<Either<Error, Entity>> {
    try {
      const entity = await this.model.create(createData as any);
      return right(this.mapper.stringify(entity as unknown as Doc));
    } catch (error) {
      return left(error as Error);
    }
  }

  async saveMany(createData: Create[]): Promise<Either<Error, Entity[]>> {
    try {
      const entities = await this.model.insertMany<any>(createData);
      return right(this.mapper.stringifyMany(entities));
    } catch (error) {
      return left(error as Error);
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

  async bulkUpdate(updates: BulkUpdate<Entity>[]): Promise<Either<Error, boolean>> {
    try {
      if (!updates.length) {
        return right(true);
      }

      await this.model.bulkWrite<any>(
        _.map(updates, (bulkUpdate) => {
          return {
            updateOne: {
              filter: { [bulkUpdate.filter.key]: bulkUpdate.filter.value },
              update: {
                $set: bulkUpdate.update.set ?? {},
                $unset: _.reduce(
                  _.keys(bulkUpdate.update.remove ?? {}),
                  (acc: Partial<Entity>, field) => {
                    acc[field] = '';
                    return acc;
                  },
                  {},
                ),
                $inc: bulkUpdate.update.inc ?? {},
              },
            },
          };
        }),
      );

      return right(true);
    } catch (error) {
      return left(error as Error);
    }
  }
}
