import {
  BulkUpdate,
  CreateOf,
  DatabaseRepository,
  DatabaseRepositoryGetList,
  DatabaseRepositoryGetListRes,
  OptionsOf,
  QueryOf,
  UpdateOf,
} from '@backend/common';
import type { NestCommon } from '@backend/proto';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { UpdateFilter } from 'mongodb';
import { Model, QueryFilter, UpdateQuery } from 'mongoose';
import { MongoEntity } from '../entities';
import { MongoMapper } from '../mappers';

const logger = new Logger('MongoRepository');

export abstract class MongoRepositoryImpl<
  Doc extends MongoEntity,
  Entity extends NestCommon.Entity = NestCommon.Entity,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
> implements DatabaseRepository<Entity, Query, Create, Update> {
  /**
   * What a client reads in this repository's errors ("Storage object not found"). A miss reaches
   * the admin panel verbatim, so it names the resource, never the collection behind it.
   */
  protected abstract readonly resourceName: string;

  protected constructor(
    protected readonly model: Model<Doc>,
    protected readonly mapper: MongoMapper<Doc, Entity, Query> = new MongoMapper(),
  ) {}

  // A failed read is thrown, never answered with an empty page or set that reads as "nothing
  // matched". Logged here because the transport reports it only as an unknown error.
  protected toFailure(action: string, error: unknown): Error {
    logger.error(`Failed to ${action} ${this.resourceName}`, error);
    return error as Error;
  }

  // A bulk write whose query came out of the mapper with no condition would reach every document —
  // refused as the caller's mistake, never run. `@backend/pg` has the reason it is one request away.
  protected transformBulkQuery(action: string, query: Partial<Query>): QueryFilter<Doc> {
    const transformedQuery = this.mapper.transformQuery(query);

    if (_.isEmpty(transformedQuery)) {
      throw new BadRequestException(`${this.resourceName} ${action}: a filter is required`);
    }

    return transformedQuery;
  }

  protected notFound(): NotFoundException {
    return new NotFoundException(`${this.resourceName} not found`);
  }

  private getPopulate<E extends NestCommon.Entity = Entity>(options: OptionsOf<E> = {}) {
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
    query: Partial<Query> = {},
  ): Promise<Set<Entity[Field]>> {
    const property = field.toString();

    try {
      const values = (await this.model
        .distinct(property, this.mapper.transformQuery(query))
        .exec()) as Entity[Field][];

      return new Set(_.reject(values, _.isNil));
    } catch (error) {
      // Never an empty set: that reads as "no values", and hides a broken query.
      throw this.toFailure(`read distinct ${property} of`, error);
    }
  }

  async getById<E extends NestCommon.Entity = Entity>(
    id: string,
    options: OptionsOf<E> = {},
  ): Promise<Either<NotFoundException, E>> {
    return this.getOne({ id } as Partial<Query>, options);
  }

  async getOne<E extends NestCommon.Entity = Entity>(
    query: Partial<Query> = {},
    options: OptionsOf<E> = {},
  ): Promise<Either<NotFoundException, E>> {
    const entity = await this.model
      .findOne<Doc>(this.mapper.transformQuery(query), null, {
        populate: this.getPopulate(options),
      })
      .exec();

    if (!entity) {
      return left(this.notFound());
    }

    return right(this.mapper.stringify(entity) as unknown as E);
  }

  async getMany<E extends NestCommon.Entity = Entity>(
    query: Partial<Query> = {},
    options: OptionsOf<E> = {},
  ): Promise<E[]> {
    const entities = await this.model
      .find<Doc>(this.mapper.transformQuery(query), null, { populate: this.getPopulate(options) })
      .exec();

    return this.mapper.stringifyMany(entities) as unknown as E[];
  }

  async getList<E extends NestCommon.Entity = Entity>(
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
      // Never an empty page: that reads as "nothing matches", and hides a broken filter.
      throw this.toFailure('list', error);
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

  async deleteMany(query: Partial<Query>): Promise<boolean> {
    const result = await this.model.deleteMany(this.transformBulkQuery('delete', query)).exec();
    return !!result.deletedCount;
  }

  async deleteOne(query: Partial<Query> = {}): Promise<Either<NotFoundException, Entity>> {
    const entity = await this.model.findOneAndDelete<Doc>(this.mapper.transformQuery(query)).exec();

    if (!entity) {
      return left(this.notFound());
    }

    return right(this.mapper.stringify(entity));
  }

  async updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>> {
    return this.updateOne({ id } as Partial<Query>, updateData);
  }

  private convertUpdate(updateData: Update): UpdateQuery<Doc> {
    return {
      $set: updateData['set'] ?? {},
      $unset: _.reduce(
        (updateData['remove'] ?? []) as string[],
        (acc: Record<string, ''>, field) => {
          acc[field] = '';
          return acc;
        },
        {},
      ),
      $inc: updateData['inc'] ?? {},
    } as UpdateQuery<Doc>;
  }

  async updateMany(query: Partial<Query>, updateData: Update): Promise<boolean> {
    const result = await this.model
      .updateMany(this.transformBulkQuery('update', query), this.convertUpdate(updateData))
      .exec();

    return !!result.modifiedCount;
  }

  async updateOne(
    query: Partial<Query>,
    updateData: Update,
  ): Promise<Either<NotFoundException, Entity>> {
    const entity = await this.model
      .findOneAndUpdate<Doc>(this.mapper.transformQuery(query), this.convertUpdate(updateData), {
        new: true,
      })
      .exec();

    if (!entity) {
      return left(this.notFound());
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
              update: this.convertUpdate(bulkUpdate.update as Update) as UpdateFilter<any>,
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
