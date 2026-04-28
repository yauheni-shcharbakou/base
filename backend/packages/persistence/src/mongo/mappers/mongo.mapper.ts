import { MongoEntity } from 'mongo/entities';
import { DatabaseRepositoryGetList, QueryOf } from 'common';
import _ from 'lodash';
import { MongoSort } from 'mongo/mongo.types';
import { FilterOperators } from 'mongodb';
import { QueryFilter } from 'mongoose';
import { NestCommon } from '@backend/proto';

interface ParsedLogicalFilter extends Omit<
  NestCommon.CrudLogicalFilter,
  'string' | 'number' | 'boolean'
> {
  value?: any;
}

type FilterConverter = (filter: ParsedLogicalFilter) => any;

export class MongoMapper<
  Doc extends MongoEntity,
  Entity extends NestCommon.EntityWithTimestamps,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
> {
  protected readonly fieldNameConverter: Record<string, keyof Doc | string>;

  constructor(fieldConversions: Record<string, keyof Doc | string> = {}) {
    this.fieldNameConverter = _.merge({ id: '_id' }, fieldConversions);
  }

  protected readonly additionalFilterConverters: [
    NestCommon.CrudLogicalOperator,
    FilterConverter,
  ][] = [];

  protected convertFieldName(fieldName: string): string {
    return (this.fieldNameConverter[fieldName] ?? fieldName).toString();
  }

  protected parseLogicalFilter(filter: NestCommon.CrudLogicalFilter): ParsedLogicalFilter {
    const result: ParsedLogicalFilter = _.pick(filter, ['field', 'operator']);

    if (_.isNumber(filter.number) ?? _.isBoolean(filter.boolean)) {
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

  protected readonly converterByFilter: Map<NestCommon.CrudLogicalOperator, FilterConverter> =
    new Map([
      [
        NestCommon.CrudLogicalOperator.eq,
        ({ value }) => {
          if (!value) {
            return;
          }

          return _.isString(value) ? { $regex: `^${value}$`, $options: 'i' } : value;
        },
      ],
      [
        NestCommon.CrudLogicalOperator.ne,
        ({ value }) => {
          if (!value) {
            return;
          }

          return _.isString(value)
            ? { $not: { $regex: `^${value}$`, $options: 'i' } }
            : { $ne: value };
        },
      ],
      [NestCommon.CrudLogicalOperator.eqs, this.defaultFilterConverter()],
      [NestCommon.CrudLogicalOperator.nes, this.defaultFilterConverter('$ne')],
      [NestCommon.CrudLogicalOperator.lt, this.defaultFilterConverter('$lt')],
      [NestCommon.CrudLogicalOperator.gt, this.defaultFilterConverter('$gt')],
      [NestCommon.CrudLogicalOperator.lte, this.defaultFilterConverter('$lte')],
      [NestCommon.CrudLogicalOperator.gte, this.defaultFilterConverter('$gte')],
      [
        NestCommon.CrudLogicalOperator.in,
        ({ value }) => {
          if (_.isArray(value)) {
            return { $in: value };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.nin,
        ({ value }) => {
          if (_.isArray(value)) {
            return { $nin: value };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.ina,
        ({ value }) => {
          if (_.isArray(value)) {
            return { $all: value };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.nina,
        ({ value }) => {
          if (_.isArray(value)) {
            return { $nin: value };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.contains,
        ({ value }) => {
          if (_.isString(value)) {
            return { $regex: value, $options: 'i' };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.ncontains,
        ({ value }) => {
          if (_.isString(value)) {
            return { $not: { $regex: value, $options: 'i' } };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.containss,
        ({ value }) => {
          if (_.isString(value)) {
            return { $regex: value };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.ncontainss,
        ({ value }) => {
          if (_.isString(value)) {
            return { $not: { $regex: value } };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.startswith,
        ({ value }) => {
          if (_.isString(value)) {
            return { $regex: '^' + value, $options: 'i' };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.nstartswith,
        ({ value }) => {
          if (_.isString(value)) {
            return { $not: { $regex: '^' + value, $options: 'i' } };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.startswiths,
        ({ value }) => {
          if (_.isString(value)) {
            return { $regex: '^' + value };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.startswiths,
        ({ value }) => {
          if (_.isString(value)) {
            return { $regex: '^' + value };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.nstartswiths,
        ({ value }) => {
          if (_.isString(value)) {
            return { $not: { $regex: '^' + value } };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.endswith,
        ({ value }) => {
          if (_.isString(value)) {
            return { $regex: value + '$', $options: 'i' };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.endswiths,
        ({ value }) => {
          if (_.isString(value)) {
            return { $regex: value + '$' };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.between,
        ({ value }) => {
          if (_.isArray(value)) {
            const [min, max] = value;
            return { $gte: min, $lte: max };
          }
        },
      ],
      [
        NestCommon.CrudLogicalOperator.nbetween,
        ({ value }) => {
          if (_.isArray(value)) {
            const [min, max] = value;
            return { $not: { $gte: min, $lte: max } };
          }
        },
      ],
      [NestCommon.CrudLogicalOperator.null, () => null],
      [NestCommon.CrudLogicalOperator.nnull, () => ({ $ne: null })],
      ...this.additionalFilterConverters,
    ]);

  protected convertConditionalFilter(filter: NestCommon.CrudConditionalFilter): any {
    if (!filter.value?.length) {
      return;
    }

    const mongoOperator =
      filter.operator === NestCommon.CrudConditionalOperator.or ? '$or' : '$and';

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

  transformSorters(sorters: NestCommon.CrudSorter[] = []): MongoSort {
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
