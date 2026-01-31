import { userGrpcRepository } from '@/repositories';
import { AuthDatabaseCollection } from '@packages/common';
import {
  CrudConditionalFilter,
  CrudConditionalOperator,
  CrudLogicalFilter,
  CrudSorter,
  GetListOptions,
  IdField,
} from '@packages/grpc.js';
import { BaseRecord, GetListParams, LogicalFilter } from '@refinedev/core';
import _ from 'lodash';
import { NextResponse } from 'next/server';

interface DataRepository<Entity extends BaseRecord = BaseRecord> {
  getById(request: IdField): Promise<Entity>;
  getList(request: GetListOptions): Promise<{ items: Entity[]; total: number }>;
}

const declareRepositories = () => {
  const repositoryByResource = new Map<string, DataRepository>([
    [AuthDatabaseCollection.USER, userGrpcRepository],
  ]);

  return <Entity extends BaseRecord>(resource: string): DataRepository<Entity> => {
    const repository = repositoryByResource.get(resource);

    if (!repository) {
      throw new Error('Repository not found');
    }

    // @ts-ignore
    return repository;
  };
};

const getRepository = declareRepositories();

const convertLogicalFilter = (logicalFilter: LogicalFilter): CrudLogicalFilter => {
  const filter: CrudLogicalFilter = _.pick(logicalFilter, [
    'field',
    'operator',
  ]) as CrudLogicalFilter;

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

const addId = <Entity = any>(entity: Entity) => {
  return {
    ...entity,
    //@ts-ignore
    id: entity._id,
  };
};

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const params: GetListParams = await request.json();
    console.log(params, context);

    const { resource } = await context.params;

    const repository = getRepository<any>(resource);

    const conditionalFilters: CrudConditionalFilter[] = [];
    const logicalFilters: CrudLogicalFilter[] = [];

    for (const filter of params.filters ?? []) {
      if (_.includes(_.values(CrudConditionalOperator), filter.operator)) {
        if (!filter.value?.length) {
          continue;
        }

        conditionalFilters.push({
          ...(filter as CrudConditionalFilter),
          value: _.map(filter.value, (nestedFilter) => convertLogicalFilter(nestedFilter)),
        });

        continue;
      }

      logicalFilters.push(convertLogicalFilter(filter as LogicalFilter));
    }

    const result = await repository.getList({
      conditionalFilters,
      logicalFilters,
      sorters: (params.sorters ?? []) as CrudSorter[],
      pagination: {
        page: params.pagination?.currentPage,
        limit: params.pagination?.pageSize,
      },
    });

    return NextResponse.json({
      data: _.map(result.items, (item) => addId(item)),
      total: result.total,
    });
  } catch (error) {
    console.error(error, error.stack);
    return NextResponse.json({ data: [], total: 0 });
  }
}
