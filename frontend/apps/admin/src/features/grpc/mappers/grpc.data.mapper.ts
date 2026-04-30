import { CrudFilter, CrudSort, GetListParams, LogicalFilter } from '@refinedev/core';
import _ from 'lodash';
import { BrowserCommon } from '@packages/proto';

type ParsedFilters = {
  logicalFilters: BrowserCommon.CrudLogicalFilter[];
  conditionalFilters: BrowserCommon.CrudConditionalFilter[];
};

export class GrpcDataMapper {
  protected convertLogicalFilter(logicalFilter: LogicalFilter): BrowserCommon.CrudLogicalFilter {
    const filter: BrowserCommon.CrudLogicalFilter = _.pick(logicalFilter, [
      'field',
      'operator',
    ]) as BrowserCommon.CrudLogicalFilter;

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
        if (_.includes(_.values(BrowserCommon.CrudConditionalOperator), filter.operator)) {
          if (!filter.value?.length) {
            return acc;
          }

          acc.conditionalFilters.push({
            ...(filter as BrowserCommon.CrudConditionalFilter),
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

  protected convertSorters(sorters: CrudSort[] = []): BrowserCommon.CrudSorter[] {
    return _.map(sorters, (sorter) => {
      return {
        field: sorter.field,
        order: sorter.order === 'desc' ? BrowserCommon.CrudSort.desc : BrowserCommon.CrudSort.asc,
      };
    });
  }

  convertGetListParams(params: GetListParams): BrowserCommon.GetListRequest {
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
