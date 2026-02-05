import { userGrpcRepository } from '@/repositories';
import {
  GrpcCrudConditionalFilter,
  GrpcCrudConditionalOperator,
  GrpcCrudLogicalFilter,
  GrpcCrudSort,
  GrpcCrudSorter,
  GrpcGetListRequest,
  GrpcIdField,
} from '@frontend/grpc';
import { type CallOptions, Metadata } from '@grpc/grpc-js';
import { AuthDatabaseCollection } from '@packages/common';
import { BaseRecord, CrudFilter, CrudSort, LogicalFilter } from '@refinedev/core';
import _ from 'lodash';

export interface DataRepository<Entity extends BaseRecord = BaseRecord> {
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

export const getRepository = declareRepositories();

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

type ParsedFilters = {
  logicalFilters: GrpcCrudLogicalFilter[];
  conditionalFilters: GrpcCrudConditionalFilter[];
};

export const convertFilters = (filters: CrudFilter[] = []): ParsedFilters => {
  return _.reduce(
    filters,
    (acc: ParsedFilters, filter) => {
      if (_.includes(_.values(GrpcCrudConditionalOperator), filter.operator)) {
        if (!filter.value?.length) {
          return acc;
        }

        acc.conditionalFilters.push({
          ...(filter as GrpcCrudConditionalFilter),
          value: _.map(filter.value, (nestedFilter) => convertLogicalFilter(nestedFilter)),
        });

        return acc;
      }

      acc.logicalFilters.push(convertLogicalFilter(filter as LogicalFilter));
      return acc;
    },
    {
      conditionalFilters: [],
      logicalFilters: [],
    },
  );
};

export const convertSorters = (sorters: CrudSort[] = []): GrpcCrudSorter[] => {
  return _.map(sorters, (sorter) => {
    return {
      field: sorter.field,
      order: sorter.order === 'desc' ? GrpcCrudSort.desc : GrpcCrudSort.asc,
    };
  });
};
