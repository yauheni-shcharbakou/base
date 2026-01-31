import {
  BaseQuery,
  CrudConditionalFilter,
  CrudConditionalOperator,
  CrudLogicalFilter,
  CrudLogicalOperator,
  CrudSorter,
  IdField,
} from '@backend/grpc';
import { MongoEntity } from 'entities';
import { DatabaseRepositoryGetList } from 'interfaces';
import _ from 'lodash';
import { FilterOperators } from 'mongodb';
import { QueryFilter } from 'mongoose';
import { MongoSort } from 'types';

interface ParsedLogicalFilter extends Omit<CrudLogicalFilter, 'string' | 'number' | 'boolean'> {
  value?: any;
}

type FilterConverter = (filter: ParsedLogicalFilter) => any;

export class MongoMapper<
  Entity extends IdField,
  Doc extends MongoEntity,
  Query extends BaseQuery = BaseQuery & Partial<Entity>,
> {
  protected readonly fieldNameConverter: Record<string, keyof Doc | string>;

  constructor(fieldConversions: Record<string, keyof Doc | string> = {}) {
    this.fieldNameConverter = _.merge({ id: '_id' }, fieldConversions);
  }

  protected readonly additionalFilterConverters: [CrudLogicalOperator, FilterConverter][] = [];

  protected convertFieldName(fieldName: string): string {
    return (this.fieldNameConverter[fieldName] ?? fieldName).toString();
  }

  protected parseLogicalFilter(filter: CrudLogicalFilter): ParsedLogicalFilter {
    const result: ParsedLogicalFilter = _.pick(filter, ['field', 'operator']);

    if (_.isNumber(filter.number) ?? _.isBoolean(filter.boolean)) {
      result.value = filter.number ?? filter.boolean;
      return result;
    }

    if (!_.isString(filter.string)) {
      return result;
    }

    const trimmed = filter.string.trim();
    console.log(trimmed);

    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      result.value = trimmed;
      return result;
    }

    try {
      result.value = JSON.parse(filter.string);
    } catch (e) {
      console.error(e);
    }

    return result;
  }

  protected defaultFilterConverter(mongoOperator?: keyof FilterOperators<Doc>): FilterConverter {
    if (mongoOperator) {
      return ({ value }) => {
        if (value) {
          return { [mongoOperator]: value };
        }
      };
    }

    return ({ value }) => {
      return value;
    };
  }

  protected readonly converterByFilter: Map<CrudLogicalOperator, FilterConverter> = new Map([
    [
      CrudLogicalOperator.eq,
      ({ value }) => {
        if (!value) {
          return;
        }

        return _.isString(value) ? { $regex: `^${value}$`, $options: 'i' } : value;
      },
    ],
    [
      CrudLogicalOperator.ne,
      ({ value }) => {
        if (!value) {
          return;
        }

        return _.isString(value)
          ? { $not: { $regex: `^${value}$`, $options: 'i' } }
          : { $ne: value };
      },
    ],
    [CrudLogicalOperator.eqs, this.defaultFilterConverter()],
    [CrudLogicalOperator.nes, this.defaultFilterConverter('$ne')],
    [CrudLogicalOperator.lt, this.defaultFilterConverter('$lt')],
    [CrudLogicalOperator.gt, this.defaultFilterConverter('$gt')],
    [CrudLogicalOperator.lte, this.defaultFilterConverter('$lte')],
    [CrudLogicalOperator.gte, this.defaultFilterConverter('$gte')],
    [
      CrudLogicalOperator.in,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $in: value };
        }
      },
    ],
    [
      CrudLogicalOperator.nin,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $nin: value };
        }
      },
    ],
    [
      CrudLogicalOperator.ina,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $all: value };
        }
      },
    ],
    [
      CrudLogicalOperator.nina,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $nin: value };
        }
      },
    ],
    [
      CrudLogicalOperator.contains,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value, $options: 'i' };
        }
      },
    ],
    [
      CrudLogicalOperator.ncontains,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: value, $options: 'i' } };
        }
      },
    ],
    [
      CrudLogicalOperator.containss,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value };
        }
      },
    ],
    [
      CrudLogicalOperator.ncontainss,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: value } };
        }
      },
    ],
    [
      CrudLogicalOperator.startswith,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: '^' + value, $options: 'i' };
        }
      },
    ],
    [
      CrudLogicalOperator.nstartswith,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: '^' + value, $options: 'i' } };
        }
      },
    ],
    [
      CrudLogicalOperator.startswiths,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: '^' + value };
        }
      },
    ],
    [
      CrudLogicalOperator.startswiths,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: '^' + value };
        }
      },
    ],
    [
      CrudLogicalOperator.nstartswiths,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: '^' + value } };
        }
      },
    ],
    [
      CrudLogicalOperator.endswith,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value + '$', $options: 'i' };
        }
      },
    ],
    [
      CrudLogicalOperator.endswiths,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value + '$' };
        }
      },
    ],
    [
      CrudLogicalOperator.between,
      ({ value }) => {
        if (_.isArray(value)) {
          const [min, max] = value;
          return { $gte: min, $lte: max };
        }
      },
    ],
    [
      CrudLogicalOperator.nbetween,
      ({ value }) => {
        if (_.isArray(value)) {
          const [min, max] = value;
          return { $not: { $gte: min, $lte: max } };
        }
      },
    ],
    [CrudLogicalOperator.null, () => null],
    [CrudLogicalOperator.nnull, () => ({ $ne: null })],
    ...this.additionalFilterConverters,
  ]);

  protected convertConditionalFilter(filter: CrudConditionalFilter): any {
    if (!filter.value?.length) {
      return;
    }

    const mongoOperator = filter.operator === CrudConditionalOperator.or ? '$or' : '$and';

    return {
      [mongoOperator]: _.reduce(
        filter.value,
        (acc: any[], logicalFilter) => {
          const parsedFilter = this.parseLogicalFilter(logicalFilter);
          const converter = this.converterByFilter.get(logicalFilter.operator);
          const generated = converter(parsedFilter);

          if (generated !== undefined) {
            acc.push(generated);
            return acc;
          }
        },
        [],
      ),
    };
  }

  transformSorters(sorters: CrudSorter[] = []): MongoSort {
    return _.reduce(
      sorters,
      (acc: MongoSort, sorter) => {
        acc[this.convertFieldName(sorter.field).toString()] = sorter.order;
        return acc;
      },
      {},
    );
  }

  transformQuery({ id, ids, ...rest }: Partial<Query>): QueryFilter<Doc> {
    const result: QueryFilter<any> = _.omitBy(rest, _.isNil);

    if (id) {
      result._id = id;
    }

    if (ids?.length) {
      result._id = {
        $in: ids,
      };
    }

    return result;
  }

  transformListQuery({
    query,
    logicalFilters,
    conditionalFilters,
  }: DatabaseRepositoryGetList<Query>): QueryFilter<Doc> {
    let queryFilter: QueryFilter<Doc> = {};

    if (query) {
      queryFilter = this.transformQuery(query ?? {});
    }

    _.forEach(logicalFilters ?? [], (filter) => {
      const parsedFilter = this.parseLogicalFilter(filter);
      const converter = this.converterByFilter.get(filter.operator);
      const generated = converter(parsedFilter);

      console.log('filter', parsedFilter, generated, this.convertFieldName(filter.field));

      if (generated === undefined) {
        return;
      }

      // @ts-ignore
      queryFilter[this.convertFieldName(filter.field)] = generated;
    });

    _.forEach(conditionalFilters ?? [], (filter) => {
      const generated = this.convertConditionalFilter(filter);

      if (generated === undefined) {
        return;
      }

      if (filter.key) {
        // @ts-ignore
        queryFilter[this.convertFieldName(filter.key)] = generated;
        return;
      }

      queryFilter = _.merge(queryFilter, generated);
    });

    console.log('LIST QUERY', queryFilter);
    return queryFilter;
  }

  stringify(entity: Doc): Entity {
    return entity.toJSON({ flattenMaps: false });
  }

  stringifyMany(entities: Doc[]): Entity[] {
    return entities.map((entity) => this.stringify(entity));
  }
}
