'use server';

import { userGrpcRepository } from '@/repositories';
import { AuthDatabaseCollection } from '@packages/common';
import {
  GrpcCrudConditionalFilter,
  GrpcCrudConditionalOperator,
  GrpcCrudLogicalFilter,
  GrpcCrudSort,
  GrpcGetListRequest,
  GrpcIdField,
} from '@frontend/grpc';
import {
  BaseRecord,
  CreateParams,
  CreateResponse,
  GetListParams,
  GetListResponse,
  GetOneParams,
  GetOneResponse,
  LogicalFilter,
  UpdateParams,
  UpdateResponse,
  DeleteOneParams,
  DeleteOneResponse,
} from '@refinedev/core';
import _ from 'lodash';
import { type CallOptions, Metadata } from '@grpc/grpc-js';
import { cookies } from 'next/headers';

interface DataRepository<Entity extends BaseRecord = BaseRecord> {
  getById(
    request: GrpcIdField,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<Entity>;
  // getMany(
  //   request: { ids: string[] },
  //   metadata?: Metadata,
  //   options?: Partial<CallOptions>,
  // ): Promise<{ items: Entity[] }>;
  getList(
    request: GrpcGetListRequest,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<{ items: Entity[]; total: number }>;
  createOne(
    request: Partial<Entity>,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<Entity>;
  updateById(
    request: GrpcIdField & { update: { set: Partial<Entity> } },
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<Entity>;
  deleteById(
    request: GrpcIdField,
    metadata?: Metadata,
    options?: Partial<CallOptions>,
  ): Promise<Entity>;
}

const declareRepositories = () => {
  const repositoryByResource = new Map([[AuthDatabaseCollection.USER, userGrpcRepository]]);

  return <Entity extends BaseRecord>(resource: string): DataRepository<Entity> => {
    const repository = repositoryByResource.get(resource as any);

    if (!repository) {
      throw new Error('Repository not found');
    }

    // @ts-ignore
    return repository;
  };
};

const getRepository = declareRepositories();

const convertLogicalFilter = (logicalFilter: LogicalFilter): GrpcCrudLogicalFilter => {
  const filter: GrpcCrudLogicalFilter = _.pick(logicalFilter, [
    'field',
    'operator',
  ]) as GrpcCrudLogicalFilter;

  if (_.isString(logicalFilter.value)) {
    filter.string = logicalFilter.value;
    return filter;
  }

  if (_.isNumber(logicalFilter.value)) {
    filter.number = logicalFilter.value;
    return filter;
  }

  if (_.isBoolean(logicalFilter.value)) {
    filter.boolean = logicalFilter.value;
    return filter;
  }

  if (_.isObject(logicalFilter.value)) {
    filter.string = JSON.stringify(logicalFilter.value);
    return filter;
  }

  return filter;
};

const getAuthMetadata = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('access-token')?.value;

  if (!token) {
    return new Metadata();
  }

  const meta = new Metadata();
  meta.set('access-token', token);
  return meta;
};

export async function getOne<Entity extends BaseRecord>(
  params: GetOneParams,
): Promise<GetOneResponse<Entity>> {
  const metadata = await getAuthMetadata();
  const repository = getRepository<Entity>(params.resource);
  const entity = await repository.getById({ id: params.id.toString() }, metadata);
  return { data: entity };
}

export async function getList<Entity extends BaseRecord>(
  params: GetListParams,
): Promise<GetListResponse<Entity>> {
  try {
    const metadata = await getAuthMetadata();
    const repository = getRepository<Entity>(params.resource);

    const conditionalFilters: GrpcCrudConditionalFilter[] = [];
    const logicalFilters: GrpcCrudLogicalFilter[] = [];

    for (const filter of params.filters ?? []) {
      if (_.includes(_.values(GrpcCrudConditionalOperator), filter.operator)) {
        if (!filter.value?.length) {
          continue;
        }

        conditionalFilters.push({
          ...(filter as GrpcCrudConditionalFilter),
          value: _.map(filter.value, (nestedFilter) => convertLogicalFilter(nestedFilter)),
        });

        continue;
      }

      logicalFilters.push(convertLogicalFilter(filter as LogicalFilter));
    }

    const result = await repository.getList(
      {
        conditionalFilters,
        logicalFilters,
        sorters: _.map(params.sorters ?? [], (sorter) => {
          return {
            field: sorter.field,
            order: sorter.order === 'desc' ? GrpcCrudSort.desc : GrpcCrudSort.asc,
          };
        }),
        pagination: {
          page: params.pagination?.currentPage,
          limit: params.pagination?.pageSize,
        },
      },
      metadata,
    );

    return {
      data: result.items,
      total: result.total,
    };
  } catch (error) {
    // @ts-ignore
    console.error(error);
    return { data: [], total: 0 };
  }
}

export async function createOne<Entity extends BaseRecord, TVariables>(
  params: CreateParams<TVariables>,
): Promise<CreateResponse<Entity>> {
  const metadata = await getAuthMetadata();
  const repository = getRepository<Entity>(params.resource);
  const entity = await repository.createOne(params.variables as Partial<Entity>, metadata);
  return { data: entity };
}

export async function updateOne<Entity extends BaseRecord, TVariables>(
  params: UpdateParams<TVariables>,
): Promise<UpdateResponse<Entity>> {
  const metadata = await getAuthMetadata();
  const repository = getRepository<Entity>(params.resource);

  const entity = await repository.updateById(
    {
      id: params.id.toString(),
      update: { set: params.variables as Partial<Entity> },
    },
    metadata,
  );

  return { data: entity };
}

export async function deleteOne<Entity extends BaseRecord, TVariables>(
  params: DeleteOneParams<TVariables>,
): Promise<DeleteOneResponse<Entity>> {
  const metadata = await getAuthMetadata();
  const repository = getRepository<Entity>(params.resource);
  const entity = await repository.deleteById({ id: params.id.toString() }, metadata);
  return { data: entity };
}
