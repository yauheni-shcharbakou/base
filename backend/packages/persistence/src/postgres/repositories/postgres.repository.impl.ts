import { GrpcEntityWithTimestamps } from '@backend/grpc';
import { FilterQuery, Populate, RequiredEntityData, wrap } from '@mikro-orm/core';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import {
  BulkUpdate,
  CreateOf,
  DatabaseRepository,
  DatabaseRepositoryGetList,
  DatabaseRepositoryGetListRes,
  OptionsOf,
  QueryOf,
  UpdateOf,
} from 'common';
import _ from 'lodash';
import { PostgresEntity } from 'postgres/entities';
import { PostgresMapper } from 'postgres/mappers';

export abstract class PostgresRepositoryImpl<
  Doc extends PostgresEntity<any>,
  Entity extends GrpcEntityWithTimestamps,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
  Create = CreateOf<Entity>,
  Update = UpdateOf<Entity>,
> implements DatabaseRepository<Entity, Query, Create, Update> {
  protected readonly em: EntityManager;

  protected constructor(
    protected readonly repository: EntityRepository<Doc>,
    protected readonly mapper: PostgresMapper<Doc, Entity, Query> = new PostgresMapper(),
  ) {
    this.em = repository.getEntityManager();
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

  protected getPopulate<E extends GrpcEntityWithTimestamps = Entity>(options: OptionsOf<E> = {}) {
    if (!options.populate) {
      return undefined;
    }

    return options.populate as unknown as Populate<Doc>;
  }

  async count(query: Partial<Query> = {}): Promise<number> {
    return this.repository.count(this.mapper.transformQuery(query));
  }

  async distinct<Field extends keyof Entity>(
    field: Field,
    query?: Partial<Query>,
  ): Promise<Set<Entity[Field]>> {
    try {
      const transformedQuery = this.mapper.transformQuery(query);

      const entities = await this.repository.find(transformedQuery, {
        limit: 1_000,
        fields: [field.toString() as any],
      });

      return _.reduce(
        entities,
        (acc: Set<Entity[Field]>, entity: Doc) => {
          const wrappedEntity = wrap(entity).toJSON();
          const value = wrappedEntity[field.toString()];

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

  async deleteById(id: string): Promise<Either<NotFoundException, Entity>> {
    return this.deleteOne({ id } as Partial<Query>);
  }

  async deleteMany(query?: Partial<Query>): Promise<boolean> {
    try {
      const transformedQuery = this.mapper.transformQuery(query);

      let page = 1;
      let hasNext = false;
      const limit = 100;

      do {
        const [entities, total] = await this.repository.findAndCount(transformedQuery, {
          limit,
          offset: (page - 1) * limit,
        });

        _.forEach(entities, (entity) => {
          this.em.remove(entity);
        });

        hasNext = page * limit < total;
        page += 1;
      } while (hasNext);

      await this.em.flush();
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteOne(query?: Partial<Query>): Promise<Either<NotFoundException, Entity>> {
    try {
      const entity = await this.repository.findOne(this.mapper.transformQuery(query));

      if (!entity) {
        return left(new NotFoundException(`${this.repository.getEntityName()} not found`));
      }

      await this.em.remove(entity).flush();
      return right(this.mapper.stringify(entity));
    } catch (error) {
      return left(error as NotFoundException);
    }
  }

  async getById<E extends GrpcEntityWithTimestamps = Entity>(
    id: string,
    options: OptionsOf<E> = {},
  ): Promise<Either<NotFoundException, E>> {
    return this.getOne({ id } as Partial<Query>, options);
  }

  async getList<E extends GrpcEntityWithTimestamps = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    options: OptionsOf<E> = {},
  ): Promise<DatabaseRepositoryGetListRes<E>> {
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
      return { items: [], total: 0 };
    }
  }

  async getMany<E extends GrpcEntityWithTimestamps = Entity>(
    query?: Partial<Query>,
    options: OptionsOf<E> = {},
  ): Promise<E[]> {
    const populate = this.getPopulate(options);
    const transformedQuery = this.mapper.transformQuery(query);

    const entities = _.isEmpty(transformedQuery)
      ? await this.repository.findAll({ populate })
      : await this.repository.find(this.mapper.transformQuery(query), { populate });

    return this.mapper.stringifyMany(entities) as unknown as E[];
  }

  async getOne<E extends GrpcEntityWithTimestamps = Entity>(
    query: Partial<Query> = {},
    options: OptionsOf<E> = {},
  ): Promise<Either<NotFoundException, E>> {
    const populate = this.getPopulate(options);
    const entity = await this.repository.findOne(this.mapper.transformQuery(query), { populate });

    if (!entity) {
      return left(new NotFoundException(`${this.repository.getEntityName()} not found`));
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
      return left(error as Error);
    }
  }

  async saveOne(createData: Create): Promise<Either<Error, Entity>> {
    try {
      const entity = this.repository.create(createData as RequiredEntityData<Doc>);
      await this.em.persist(entity).flush();
      return right(this.mapper.stringify(entity));
    } catch (error) {
      return left(error as Error);
    }
  }

  async updateById(id: string, updateData: Update): Promise<Either<NotFoundException, Entity>> {
    return this.updateOne({ id } as Partial<Query>, updateData);
  }

  async updateMany(query: Partial<Query>, updateData: Update): Promise<boolean> {
    try {
      const transformedQuery = this.mapper.transformQuery(query);

      let page = 1;
      let hasNext = false;
      const limit = 100;

      do {
        const [entities, total] = await this.repository.findAndCount(transformedQuery, {
          limit,
          offset: (page - 1) * limit,
        });

        _.forEach(entities, (entity) => {
          this.convertUpdate(entity, updateData);
        });

        hasNext = page * limit < total;
        page += 1;
      } while (hasNext);

      await this.em.flush();
      return true;
    } catch (error) {
      return false;
    }
  }

  async updateOne(
    query: Partial<Query>,
    updateData: Update,
  ): Promise<Either<NotFoundException, Entity>> {
    try {
      const entity = await this.repository.findOne(this.mapper.transformQuery(query));

      if (!entity) {
        return left(new NotFoundException(`${this.repository.getEntityName()} not found`));
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
