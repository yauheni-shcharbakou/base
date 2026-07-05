import { BrowserCommon } from '@packages/proto';
import { CrudFilter, CrudSort, GetListParams, LogicalFilter } from '@refinedev/core';
import _ from 'lodash';

type ParsedFilters = {
  logicalFilters: BrowserCommon.LogicalFilter[];
  conditionalFilters: BrowserCommon.ConditionalFilter[];
};

export class GrpcDataMapper {
  protected convertLogicalFilter(logicalFilter: LogicalFilter): BrowserCommon.LogicalFilter {
    const filter: BrowserCommon.LogicalFilter = _.pick(logicalFilter, [
      'field',
      'operator',
    ]) as BrowserCommon.LogicalFilter;

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
        if (_.includes(_.values(BrowserCommon.ConditionalOperator), filter.operator)) {
          if (!filter.value?.length) {
            return acc;
          }

          acc.conditionalFilters.push({
            ...(filter as BrowserCommon.ConditionalFilter),
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

  protected convertSorters(sorters: CrudSort[] = []): BrowserCommon.Sorter[] {
    return _.map(sorters, (sorter) => {
      return {
        field: sorter.field,
        order: sorter.order === 'desc' ? BrowserCommon.Sort.desc : BrowserCommon.Sort.asc,
      };
    });
  }

  convertGetListParams(params: GetListParams): BrowserCommon.GetList {
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
