import {
  GrpcBaseQuery,
  GrpcCrudConditionalFilter,
  GrpcCrudConditionalOperator,
  GrpcCrudLogicalFilter,
  GrpcCrudLogicalOperator,
  GrpcCrudSorter,
  GrpcIdField,
} from '@backend/grpc';
import { MongoEntity } from 'entities';
import { DatabaseRepositoryGetList } from 'interfaces';
import _ from 'lodash';
import { FilterOperators } from 'mongodb';
import { QueryFilter } from 'mongoose';
import { MongoSort } from 'types';

interface ParsedLogicalFilter extends Omit<GrpcCrudLogicalFilter, 'string' | 'number' | 'boolean'> {
  value?: any;
}

type FilterConverter = (filter: ParsedLogicalFilter) => any;

export class MongoMapper<
  Entity extends GrpcIdField,
  Doc extends MongoEntity,
  Query extends GrpcBaseQuery = GrpcBaseQuery & Partial<Entity>,
> {
  protected readonly fieldNameConverter: Record<string, keyof Doc | string>;

  constructor(fieldConversions: Record<string, keyof Doc | string> = {}) {
    this.fieldNameConverter = _.merge({ id: '_id' }, fieldConversions);
  }

  protected readonly additionalFilterConverters: [GrpcCrudLogicalOperator, FilterConverter][] = [];

  protected convertFieldName(fieldName: string): string {
    return (this.fieldNameConverter[fieldName] ?? fieldName).toString();
  }

  protected parseLogicalFilter(filter: GrpcCrudLogicalFilter): ParsedLogicalFilter {
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

  protected readonly converterByFilter: Map<GrpcCrudLogicalOperator, FilterConverter> = new Map([
    [
      GrpcCrudLogicalOperator.eq,
      ({ value }) => {
        if (!value) {
          return;
        }

        return _.isString(value) ? { $regex: `^${value}$`, $options: 'i' } : value;
      },
    ],
    [
      GrpcCrudLogicalOperator.ne,
      ({ value }) => {
        if (!value) {
          return;
        }

        return _.isString(value)
          ? { $not: { $regex: `^${value}$`, $options: 'i' } }
          : { $ne: value };
      },
    ],
    [GrpcCrudLogicalOperator.eqs, this.defaultFilterConverter()],
    [GrpcCrudLogicalOperator.nes, this.defaultFilterConverter('$ne')],
    [GrpcCrudLogicalOperator.lt, this.defaultFilterConverter('$lt')],
    [GrpcCrudLogicalOperator.gt, this.defaultFilterConverter('$gt')],
    [GrpcCrudLogicalOperator.lte, this.defaultFilterConverter('$lte')],
    [GrpcCrudLogicalOperator.gte, this.defaultFilterConverter('$gte')],
    [
      GrpcCrudLogicalOperator.in,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $in: value };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.nin,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $nin: value };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.ina,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $all: value };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.nina,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $nin: value };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.contains,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value, $options: 'i' };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.ncontains,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: value, $options: 'i' } };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.containss,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.ncontainss,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: value } };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.startswith,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: '^' + value, $options: 'i' };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.nstartswith,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: '^' + value, $options: 'i' } };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.startswiths,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: '^' + value };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.startswiths,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: '^' + value };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.nstartswiths,
      ({ value }) => {
        if (_.isString(value)) {
          return { $not: { $regex: '^' + value } };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.endswith,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value + '$', $options: 'i' };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.endswiths,
      ({ value }) => {
        if (_.isString(value)) {
          return { $regex: value + '$' };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.between,
      ({ value }) => {
        if (_.isArray(value)) {
          const [min, max] = value;
          return { $gte: min, $lte: max };
        }
      },
    ],
    [
      GrpcCrudLogicalOperator.nbetween,
      ({ value }) => {
        if (_.isArray(value)) {
          const [min, max] = value;
          return { $not: { $gte: min, $lte: max } };
        }
      },
    ],
    [GrpcCrudLogicalOperator.null, () => null],
    [GrpcCrudLogicalOperator.nnull, () => ({ $ne: null })],
    ...this.additionalFilterConverters,
  ]);

  protected convertConditionalFilter(filter: GrpcCrudConditionalFilter): any {
    if (!filter.value?.length) {
      return;
    }

    const mongoOperator = filter.operator === GrpcCrudConditionalOperator.or ? '$or' : '$and';

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

  transformSorters(sorters: GrpcCrudSorter[] = []): MongoSort {
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

    return queryFilter;
  }

  stringify(entity: Doc): Entity {
    return entity.toJSON({ flattenMaps: false });
  }

  stringifyMany(entities: Doc[]): Entity[] {
    return entities.map((entity) => this.stringify(entity));
  }
}
