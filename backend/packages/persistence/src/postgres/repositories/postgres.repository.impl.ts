import { GrpcEntityWithTimestamps } from '@backend/grpc';
import {
  EntityData,
  Populate,
  raw,
  RequestContext,
  RequiredEntityData,
  wrap,
} from '@mikro-orm/core';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import {
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
  Options extends OptionsOf<Entity> = OptionsOf<Entity>,
> implements DatabaseRepository<Entity, Query, Create, Update, Options> {
  protected readonly em: EntityManager;

  protected constructor(
    protected readonly repository: EntityRepository<Doc>,
    protected readonly mapper: PostgresMapper<Entity, Doc, Query> = new PostgresMapper(),
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
        entity[key] = (entity[key] || 0) + val;
      });
    }

    return entity;
  }

  // protected getEm(options?: Partial<Options>) {
  //   return options?.isolated ? this.em.fork() : this.em;
  // }

  protected getPopulate(options?: Partial<Options>) {
    return options?.populate as unknown as Populate<Doc>;
  }

  // protected convertOptions(options?: Partial<Options>) {
  //   return {
  //     em: options?.isolated ? this.em.fork() : undefined,
  //     populate: this.getPopulate(options),
  //   };
  // }

  async count(query: Partial<Query> = {}, options: Partial<Options> = {}): Promise<number> {
    return this.repository.count(this.mapper.transformQuery(query));
  }

  async deleteById(
    id: string,
    options: Partial<Options> = {},
  ): Promise<Either<NotFoundException, Entity>> {
    return this.deleteOne({ id } as Partial<Query>, options);
  }

  async deleteMany(query?: Partial<Query>, options: Partial<Options> = {}): Promise<boolean> {
    const rows = await this.repository.nativeDelete(this.mapper.transformQuery(query));
    return !!rows;
  }

  async deleteOne(
    query?: Partial<Query>,
    options: Partial<Options> = {},
  ): Promise<Either<NotFoundException, Entity>> {
    try {
      const populate = this.getPopulate(options);
      const entity = await this.repository.findOne(this.mapper.transformQuery(query), { populate });

      if (!entity) {
        return left(new NotFoundException(`${this.repository.getEntityName()} not found`));
      }

      await this.em.remove(entity).flush();
      return right(this.mapper.stringify(entity));
    } catch (error) {
      return left(error as NotFoundException);
    }
  }

  async getById(
    id: string,
    options: Partial<Options> = {},
  ): Promise<Either<NotFoundException, Entity>> {
    return this.getOne({ id } as Partial<Query>, options);
  }

  async getList<E = Entity>(
    request: DatabaseRepositoryGetList<Query>,
    options: Partial<Options> = {},
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

  async getMany(query?: Partial<Query>, options: Partial<Options> = {}): Promise<Entity[]> {
    const populate = this.getPopulate(options);
    const entities = await this.repository.find(this.mapper.transformQuery(query), { populate });
    return this.mapper.stringifyMany(entities);
  }

  async getOne(
    query: Partial<Query> = {},
    options: Partial<Options> = {},
  ): Promise<Either<NotFoundException, Entity>> {
    const populate = this.getPopulate(options);
    const entity = await this.repository.findOne(this.mapper.transformQuery(query), { populate });

    if (!entity) {
      return left(new NotFoundException(`${this.repository.getEntityName()} not found`));
    }

    return right(this.mapper.stringify(entity));
  }

  async isExists(query: Partial<Query> = {}, options: Partial<Options> = {}): Promise<boolean> {
    const count = await this.count(query, options);
    return !!count;
  }

  async isExistsById(id: string, options: Partial<Options> = {}): Promise<boolean> {
    return this.isExists({ id } as Partial<Query>, options);
  }

  async saveMany(
    createData: Create[],
    options: Partial<Options> = {},
  ): Promise<Either<Error, Entity[]>> {
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

  async saveOne(
    createData: Create,
    options: Partial<Options> = {},
  ): Promise<Either<Error, Entity>> {
    try {
      const entity = this.repository.create(createData as RequiredEntityData<Doc>);
      await this.em.persist(entity).flush();
      return right(this.mapper.stringify(entity));
    } catch (error) {
      return left(error as Error);
    }
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
    try {
      const updateQuery = this.em.createQueryBuilder<Doc>(this.repository.getEntityName());

      const plainData: EntityData<Doc> = {
        ...(updateData['set'] ?? {}),
        updatedAt: new Date(),
      };

      if (updateData['remove']) {
        _.forEach(_.keys(updateData['remove']), (key) => {
          plainData[key] = null;
        });
      }

      if (updateData['inc']) {
        _.forEach(_.entries(updateData['inc']), ([key, value]) => {
          plainData[key] = raw('?? + ?', [key, value]);
        });
      }

      const result = await updateQuery
        .update(plainData)
        .where(this.mapper.transformQuery(query))
        .execute('run');

      return !!result.affectedRows;
    } catch (error) {
      return false;
    }
  }

  async updateOne(
    query: Partial<Query>,
    updateData: Update,
    options: Partial<Options> = {},
  ): Promise<Either<NotFoundException, Entity>> {
    try {
      const populate = this.getPopulate(options);
      const entity = await this.repository.findOne(this.mapper.transformQuery(query), { populate });

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

  async isolatedRun<Res>(callback: () => Promise<Res>): Promise<Res> {
    return new Promise<Res>((resolve, reject) => {
      RequestContext.create(this.em, async () => {
        try {
          const res = await callback();
          resolve(res);
        } catch (e) {
          reject(e);
        }
      });
    });
  }
}
