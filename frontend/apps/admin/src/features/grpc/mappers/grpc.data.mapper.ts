import {
  GrpcCrudConditionalFilter,
  GrpcCrudLogicalFilter,
  GrpcCrudConditionalOperator,
  GrpcCrudSort,
  GrpcCrudSorter,
  GrpcGetListRequest,
} from '@packages/grpc';
import { CrudFilter, CrudSort, GetListParams, LogicalFilter } from '@refinedev/core';
import _ from 'lodash';

type ParsedFilters = {
  logicalFilters: GrpcCrudLogicalFilter[];
  conditionalFilters: GrpcCrudConditionalFilter[];
};

export class GrpcDataMapper {
  protected convertLogicalFilter(logicalFilter: LogicalFilter): GrpcCrudLogicalFilter {
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
  }

  protected convertFilters(filters: CrudFilter[] = []): ParsedFilters {
    return _.reduce(
      filters,
      (acc: ParsedFilters, filter) => {
        if (_.includes(_.values(GrpcCrudConditionalOperator), filter.operator)) {
          if (!filter.value?.length) {
            return acc;
          }

          acc.conditionalFilters.push({
            ...(filter as GrpcCrudConditionalFilter),
            value: _.map(filter.value, (nestedFilter) => this.convertLogicalFilter(nestedFilter)),
          });

          return acc;
        }

        acc.logicalFilters.push(this.convertLogicalFilter(filter as LogicalFilter));
        return acc;
      },
      {
        conditionalFilters: [],
        logicalFilters: [],
      },
    );
  }

  protected convertSorters(sorters: CrudSort[] = []): GrpcCrudSorter[] {
    return _.map(sorters, (sorter) => {
      return {
        field: sorter.field,
        order: sorter.order === 'desc' ? GrpcCrudSort.desc : GrpcCrudSort.asc,
      };
    });
  }

  convertGetListParams(params: GetListParams): GrpcGetListRequest {
    return {
      ...this.convertFilters(params.filters),
      sorters: this.convertSorters(params.sorters),
      pagination: {
        page: params.pagination?.currentPage,
        limit: params.pagination?.pageSize,
      },
    };
  }
}
