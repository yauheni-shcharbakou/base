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
import {
  FilterQuery,
  Populate,
  RequiredEntityData,
  UniqueConstraintViolationException,
  wrap,
} from '@mikro-orm/core';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { PgEntity } from '../entities';
import { PgMapper } from '../mappers';

const logger = new Logger('PgRepository');

export abstract class PgRepositoryImpl<
  Doc extends PgEntity<any>,
  Entity extends NestCommon.Entity,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
> implements DatabaseRepository<Entity, Query, Create, Update> {
  protected readonly em: EntityManager;

  /**
   * What a client reads in this repository's errors ("Storage object not found"). A miss reaches
   * the admin panel verbatim, so it names the resource, never the ORM class behind it.
   */
  protected abstract readonly resourceName: string;

  protected constructor(
    protected readonly repository: EntityRepository<Doc>,
    protected readonly mapper: PgMapper<Doc, Entity, Query> = new PgMapper(),
  ) {
    this.em = repository.getEntityManager() as EntityManager;
  }

  protected convertUpdate(entity: Doc, updateData: Update): Doc {
    const payload = { ...(updateData['set'] ?? {}) };

    if (updateData['remove']) {
      _.forEach(_.keys(updateData['remove']), (key) => {
        payload[key] = null;
      });
    }

    wrap(entity).assign(payload);

    if (updateData['inc']) {
      _.forEach(_.entries(updateData['inc']), ([key, val]) => {
        if (_.isNumber(val)) {
          entity[key] = (entity[key] || 0) + val;
        }
      });
    }

    return entity;
  }

  /**
   * Turns a driver-level unique violation into a `ConflictException`, the way a miss becomes a
   * `NotFoundException`. Callers can then tell "this row already exists" from a real write failure
   * — the difference matters for idempotent event handlers, which treat the former as success.
   */
  protected toRepositoryError(error: unknown): Error {
    if (error instanceof UniqueConstraintViolationException) {
      return new ConflictException(`${this.resourceName} already exists`);
    }

    return error as Error;
  }

  // A list's filters and sorts come from the caller, so a field the entity does not have is the
  // caller's mistake, named back in the 400. MikroORM would refuse it too, but with a plain `Error`
  // naming the ORM class.
  protected findUnknownListFields(request: DatabaseRepositoryGetList<Query>): string[] {
    const properties = this.em
      .getMetadata()
      .getByClassName(this.repository.getEntityName()).properties;
    return this.mapper.listFields(request).filter((field) => !(field in properties));
  }

  // A failed read or bulk write is thrown, never answered with an empty page or a `false` that
  // reads as "nothing matched". Logged here because the transport reports it only as an unknown
  // error.
  protected toFailure(action: string, error: unknown): Error {
    logger.error(`Failed to ${action} ${this.resourceName}`, error);
    return error as Error;
  }

  // A bulk write whose query came out of the mapper with no condition would reach every row. The
  // gRPC loader turns a client's unset `repeated` field into `[]`, and the mapper drops it, so "no
  // filter" is one request away — refused as the caller's mistake, never run.
  protected transformBulkQuery(action: string, query: Partial<Query>): FilterQuery<Doc> {
    const transformedQuery = this.mapper.transformQuery(query);

    if (_.isEmpty(transformedQuery)) {
      throw new BadRequestException(`${this.resourceName} ${action}: a filter is required`);
    }

    return transformedQuery;
  }

  protected notFound(): NotFoundException {
    return new NotFoundException(`${this.resourceName} not found`);
  }

  protected getPopulate<E extends NestCommon.Entity = Entity>(options: OptionsOf<E> = {}) {
    if (!options.populate) {
      return undefined;
    }

    return options.populate as unknown as Populate<Doc>;
  }

  async count(query: Partial<Query> = {}): Promise<number> {
    return this.repository.count(this.mapper.transformQuery(query));
  }

  // A real `select distinct` with no row limit: capping the rows read (not the values returned)
  // silently drops values that only occur past the cap. `null` is left out, as in Mongo.
  async distinct<Field extends keyof Entity>(
    field: Field,
    query: Partial<Query> = {},
  ): Promise<Set<Entity[Field]>> {
    const property = field.toString();

    try {
      const rows: Record<string, Entity[Field]>[] = await this.repository
        .createQueryBuilder()
        .select(property as any, true)
        .where(this.mapper.transformQuery(query) as any)
        .execute('all');

      return new Set(_.reject(_.map(rows, property), _.isNil));
    } catch (error) {
      // Never an empty set: that reads as "no values", and hides a broken query.
      throw this.toFailure(`read distinct ${property} of`, error);
    }
  }

  async deleteById(id: string): Promise<Either<NotFoundException, Entity>> {
    return this.deleteOne({ id } as Partial<Query>);
  }

  async deleteMany(query: Partial<Query>): Promise<boolean> {
    const transformedQuery = this.transformBulkQuery('delete', query);

    let page = 1;
    let hasNext = false;
    let isMatched = false;
    const limit = 100;

    try {
      do {
        const [entities, total] = await this.repository.findAndCount(transformedQuery, {
          limit,
          offset: (page - 1) * limit,
        });

        _.forEach(entities, (entity) => {
          this.em.remove(entity);
        });

        isMatched ||= total > 0;
        hasNext = page * limit < total;
        page += 1;
      } while (hasNext);

      await this.em.flush();
      return isMatched;
    } catch (error) {
      throw this.toFailure('delete', error);
    }
  }

  async deleteOne(query: Partial<Query> = {}): Promise<Either<NotFoundException, Entity>> {
    try {
      const entity = await this.repository.findOne(this.mapper.transformQuery(query));

      if (!entity) {
        return left(this.notFound());
      }

      await this.em.remove(entity).flush();
      return right(this.mapper.stringify(entity));
    } catch (error) {
      return left(error as NotFoundException);
    }
  }

  async getById<E extends NestCommon.Entity = Entity>(
    id: string,
    options: OptionsOf<E> = {},
  ): Promise<Either<NotFoundException, E>> {
    return this.getOne({ id } as Partial<Query>, options);
  }

  async getList<E extends NestCommon.Entity = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    options: OptionsOf<E> = {},
  ): Promise<DatabaseRepositoryGetListRes<E>> {
    const unknownFields = this.findUnknownListFields(request);

    if (unknownFields.length) {
      throw new BadRequestException(
        `${this.resourceName} list: unknown field ${unknownFields.join(', ')}`,
      );
    }

    try {
      const populate = this.getPopulate(options);
      const query = this.mapper.transformListQuery(request);

      const page = request.pagination?.page || 1;
      const limit = request.pagination?.limit || 100;

      const [entities, total] = await this.repository.findAndCount(query, {
        populate,
        limit,
        offset: (page - 1) * limit,
        orderBy: this.mapper.transformSorters(request.sorters),
      });

      return {
        items: this.mapper.stringifyMany(entities) as unknown as E[],
        total,
      };
    } catch (error) {
      // Never an empty page: that reads as "nothing matches", and hides a broken filter.
      throw this.toFailure('list', error);
    }
  }

  async getMany<E extends NestCommon.Entity = Entity>(
    query: Partial<Query> = {},
    options: OptionsOf<E> = {},
  ): Promise<E[]> {
    const populate = this.getPopulate(options);
    const transformedQuery = this.mapper.transformQuery(query);

    const entities = _.isEmpty(transformedQuery)
      ? await this.repository.findAll({ populate })
      : await this.repository.find(transformedQuery, { populate });

    return this.mapper.stringifyMany(entities) as unknown as E[];
  }

  async getOne<E extends NestCommon.Entity = Entity>(
    query: Partial<Query> = {},
    options: OptionsOf<E> = {},
  ): Promise<Either<NotFoundException, E>> {
    const populate = this.getPopulate(options);
    const entity = await this.repository.findOne(this.mapper.transformQuery(query), { populate });

    if (!entity) {
      return left(this.notFound());
    }

    return right(this.mapper.stringify(entity) as unknown as E);
  }

  async isExists(query: Partial<Query> = {}): Promise<boolean> {
    const count = await this.count(query);
    return !!count;
  }

  async isExistsById(id: string): Promise<boolean> {
    return this.isExists({ id } as Partial<Query>);
  }

  async saveMany(createData: Create[]): Promise<Either<Error, Entity[]>> {
    try {
      const entities = _.map(createData, (data) => {
        const entity = this.repository.create(data as RequiredEntityData<Doc>);
        this.em.persist(entity);
        return entity;
      });

      await this.em.flush();
      return right(this.mapper.stringifyMany(entities));
    } catch (error) {
      return left(this.toRepositoryError(error));
    }
  }

  async saveOne(createData: Create): Promise<Either<Error, Entity>> {
    try {
      const entity = this.repository.create(createData as RequiredEntityData<Doc>);
      await this.em.persist(entity).flush();
      return right(this.mapper.stringify(entity));
    } catch (error) {
      return left(this.toRepositoryError(error));
    }
  }

  async updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>> {
    return this.updateOne({ id } as Partial<Query>, updateData);
  }

  async updateMany(query: Partial<Query>, updateData: Update): Promise<boolean> {
    const transformedQuery = this.transformBulkQuery('update', query);

    let page = 1;
    let hasNext = false;
    let isMatched = false;
    const limit = 100;

    try {
      do {
        const [entities, total] = await this.repository.findAndCount(transformedQuery, {
          limit,
          offset: (page - 1) * limit,
        });

        _.forEach(entities, (entity) => {
          this.convertUpdate(entity, updateData);
        });

        isMatched ||= total > 0;
        hasNext = page * limit < total;
        page += 1;
      } while (hasNext);

      await this.em.flush();
      return isMatched;
    } catch (error) {
      throw this.toFailure('update', error);
    }
  }

  async updateOne(
    query: Partial<Query>,
    updateData: Update,
  ): Promise<Either<NotFoundException, Entity>> {
    try {
      const entity = await this.repository.findOne(this.mapper.transformQuery(query));

      if (!entity) {
        return left(this.notFound());
      }

      const updatedEntity = this.convertUpdate(entity, updateData);
      await this.em.flush();
      return right(this.mapper.stringify(updatedEntity));
    } catch (error) {
      return left(error as NotFoundException);
    }
  }

  async bulkUpdate(updates: BulkUpdate<Entity>[]): Promise<Either<Error, boolean>> {
    try {
      if (!updates.length) {
        return right(true);
      }

      const groups = _.groupBy(updates, (update) => update.filter.key.toString());

      for (const key in groups) {
        const bulkUpdates = groups[key];
        const values = _.map(bulkUpdates, ({ filter }) => filter.value);

        const entities = await this.repository.find({ [key]: { $in: values } } as FilterQuery<Doc>);
        const entityByValue = new Map(_.map(entities, (entity) => [entity[key], entity]));

        _.forEach(bulkUpdates, (bulkUpdate) => {
          const entity = entityByValue.get(bulkUpdate.filter.value);

          if (!entity) {
            return;
          }

          this.convertUpdate(entity, bulkUpdate.update as Update);
        });
      }

      await this.em.flush();
      return right(true);
    } catch (error) {
      return left(error as Error);
    }
  }
}
