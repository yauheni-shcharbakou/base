import _ from 'lodash';
import { FilterOperators } from 'mongodb';
import { QueryFilter } from 'mongoose';
import { NestCommon } from '@backend/proto';
import { MongoEntity } from '../entities';
import { MongoSort } from '../types';
import { DatabaseRepositoryGetList, QueryOf } from '@backend/common';

interface ParsedLogicalFilter extends Omit<
  NestCommon.LogicalFilter,
  'string' | 'number' | 'boolean'
> {
  value?: any;
}

type FilterConverter = (filter: ParsedLogicalFilter) => any;

export class MongoMapper<
  Doc extends MongoEntity,
  Entity extends NestCommon.Entity,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
> {
  protected readonly fieldNameConverter: Record<string, keyof Doc | string>;

  constructor(fieldConversions: Record<string, keyof Doc | string> = {}) {
    this.fieldNameConverter = _.merge({ id: '_id' }, fieldConversions);
  }

  protected readonly additionalFilterConverters: [NestCommon.LogicalOperator, FilterConverter][] =
    [];

  protected convertFieldName(fieldName: string): string {
    return (this.fieldNameConverter[fieldName] ?? fieldName).toString();
  }

  protected parseLogicalFilter(filter: NestCommon.LogicalFilter): ParsedLogicalFilter {
    const result: ParsedLogicalFilter = _.pick(filter, ['field', 'operator']);

    if (_.isNumber(filter.number) || _.isBoolean(filter.boolean)) {
      result.value = filter.number ?? filter.boolean;
      return result;
    }

    if (!_.isString(filter.string)) {
      return result;
    }

    const trimmed = filter.string.trim();

    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      result.value = trimmed;
      return result;
    }

    try {
      result.value = JSON.parse(filter.string);
    } catch (e) {}

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

  protected readonly converterByFilter: Map<NestCommon.LogicalOperator, FilterConverter> = new Map([
    [
      NestCommon.LogicalOperator.eq,
      ({ value }) => {
        if (!value) {
          return;
        }

        return _.isString(value) ? { $regex: `^${value}$`, $options: 'i' } : value;
      },
    ],
    [
      NestCommon.LogicalOperator.ne,
      ({ value }) => {
        if (!value) {
          return;
        }

        return _.isString(value)
          ? { $not: { $regex: `^${value}$`, $options: 'i' } }
          : { $ne: value };
      },
    ],
    [NestCommon.LogicalOperator.eqs, this.defaultFilterConverter()],
    [NestCommon.LogicalOperator.nes, this.defaultFilterConverter('$ne')],
    [NestCommon.LogicalOperator.lt, this.defaultFilterConverter('$lt')],
    [NestCommon.LogicalOperator.gt, this.defaultFilterConverter('$gt')],
    [NestCommon.LogicalOperator.lte, this.defaultFilterConverter('$lte')],
    [NestCommon.LogicalOperator.gte, this.defaultFilterConverter('$gte')],
    [
      NestCommon.LogicalOperator.in,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $in: value };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.nin,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $nin: value };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.ina,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $all: value };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.nina,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $nin: value };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.contains,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value, $options: 'i' };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.ncontains,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: value, $options: 'i' } };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.containss,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.ncontainss,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: value } };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.startswith,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: '^' + value, $options: 'i' };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.nstartswith,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: '^' + value, $options: 'i' } };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.startswiths,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: '^' + value };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.nstartswiths,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: '^' + value } };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.endswith,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value + '$', $options: 'i' };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.endswiths,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value + '$' };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.between,
      ({ value }) => {
        if (_.isArray(value)) {
          const [min, max] = value;
          return { $gte: min, $lte: max };
        }
      },
    ],
    [
      NestCommon.LogicalOperator.nbetween,
      ({ value }) => {
        if (_.isArray(value)) {
          const [min, max] = value;
          return { $not: { $gte: min, $lte: max } };
        }
      },
    ],
    [NestCommon.LogicalOperator.null, () => null],
    [NestCommon.LogicalOperator.nnull, () => ({ $ne: null })],
    ...this.additionalFilterConverters,
  ]);

  protected convertConditionalFilter(filter: NestCommon.ConditionalFilter): any {
    if (!filter.value?.length) {
      return;
    }

    const mongoOperator = filter.operator === NestCommon.ConditionalOperator.or ? '$or' : '$and';

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

  transformSorters(sorters: NestCommon.Sorter[] = []): MongoSort {
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

      if (generated === undefined) {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      queryFilter[this.convertFieldName(filter.field)] = generated;
    });

    _.forEach(conditionalFilters ?? [], (filter) => {
      const generated = this.convertConditionalFilter(filter);

      if (generated === undefined) {
        return;
      }

      if (filter.key) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        queryFilter[this.convertFieldName(filter.key)] = generated;
        return;
      }

      queryFilter = _.merge(queryFilter, generated);
    });

    return queryFilter;
  }

  stringify(entity: Doc): Entity {
    return entity.toJSON({ flattenMaps: false });
  }

  stringifyMany(entities: Doc[]): Entity[] {
    return entities.map((entity) => this.stringify(entity));
  }
}
