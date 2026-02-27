import {
  GrpcCrudConditionalFilter,
  GrpcCrudConditionalOperator,
  GrpcCrudLogicalFilter,
  GrpcCrudLogicalOperator,
  GrpcCrudSort,
  GrpcCrudSorter,
  GrpcEntityWithTimestamps,
  GrpcIdField,
} from '@backend/grpc';
import { FilterObject, ObjectQuery, wrap } from '@mikro-orm/core';
import { OperatorMap } from '@mikro-orm/core/typings';
import { DatabaseRepositoryGetList, QueryOf } from 'common/interfaces';
import _ from 'lodash';
import { PostgresEntity } from 'postgres/entities';
import { PostgresSorting } from 'postgres/postgres.types';

interface ParsedLogicalFilter extends Omit<GrpcCrudLogicalFilter, 'string' | 'number' | 'boolean'> {
  value?: any;
}

type FilterConverter = (
  filter: ParsedLogicalFilter,
) => Partial<OperatorMap<any>> | FilterObject<any>[string];

export class PostgresMapper<
  Entity extends GrpcEntityWithTimestamps,
  Doc extends PostgresEntity<any>,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
> {
  constructor(protected readonly fieldNameConverter: Record<string, keyof Doc | string> = {}) {}

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

  protected readonly converterByFilter: Map<GrpcCrudLogicalOperator, FilterConverter> = new Map([
    // Равенство (eq - регистронезависимо для строк в Postgres обычно через ILIKE или регулярку)
    [
      GrpcCrudLogicalOperator.eq,
      ({ value }) => (_.isString(value) ? { $re: `^${value}$` } : value),
    ],
    [GrpcCrudLogicalOperator.eqs, ({ value }) => value], // Строгое равенство

    // Неравенство
    [
      GrpcCrudLogicalOperator.ne,
      ({ value }) => (_.isString(value) ? { $not: { $re: `^${value}$` } } : { $ne: value }),
    ],
    [GrpcCrudLogicalOperator.nes, ({ value }) => ({ $ne: value })],

    // Сравнения
    [GrpcCrudLogicalOperator.gt, ({ value }) => ({ $gt: value })],
    [GrpcCrudLogicalOperator.gte, ({ value }) => ({ $gte: value })],
    [GrpcCrudLogicalOperator.lt, ({ value }) => ({ $lt: value })],
    [GrpcCrudLogicalOperator.lte, ({ value }) => ({ $lte: value })],

    // Списки
    [GrpcCrudLogicalOperator.in, ({ value }) => ({ $in: _.castArray(value) })],
    [GrpcCrudLogicalOperator.nin, ({ value }) => ({ $nin: _.castArray(value) })],

    // Поиск подстроки (Postgres ILIKE)
    [GrpcCrudLogicalOperator.contains, ({ value }) => ({ $ilike: `%${value}%` })],
    [GrpcCrudLogicalOperator.containss, ({ value }) => ({ $like: `%${value}%` })],
    [GrpcCrudLogicalOperator.startswith, ({ value }) => ({ $ilike: `${value}%` })],
    [GrpcCrudLogicalOperator.startswiths, ({ value }) => ({ $like: `${value}%` })],
    [GrpcCrudLogicalOperator.endswith, ({ value }) => ({ $ilike: `%${value}` })],
    [GrpcCrudLogicalOperator.endswiths, ({ value }) => ({ $like: `%${value}` })],

    // Промежутки
    [
      GrpcCrudLogicalOperator.between,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $gte: value[0], $lte: value[1] };
        }
      },
    ],

    // Null checks
    [GrpcCrudLogicalOperator.null, () => null],
    [GrpcCrudLogicalOperator.nnull, () => ({ $ne: null })],
    ...this.additionalFilterConverters,
  ]);

  protected convertConditionalFilter(filter: GrpcCrudConditionalFilter): any {
    if (!filter.value?.length) {
      return;
    }

    const operator = filter.operator === GrpcCrudConditionalOperator.or ? '$or' : '$and';

    return {
      [operator]: _.reduce(
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

  transformSorters(sorters: GrpcCrudSorter[] = []): PostgresSorting[] {
    return _.map(sorters, (sorter): PostgresSorting => {
      return { [sorter.field]: sorter.order === GrpcCrudSort.desc ? 'DESC' : 'ASC' };
    });
  }

  transformQuery({ ids, ...rest }: Partial<Query>): ObjectQuery<Doc> {
    const result = _.omitBy(rest, _.isNil) as ObjectQuery<GrpcIdField>;

    if (ids?.length) {
      result.id = { $in: ids };
    }

    return result as ObjectQuery<Doc>;
  }

  transformListQuery({
    query,
    logicalFilters,
    conditionalFilters,
  }: DatabaseRepositoryGetList<Query>): ObjectQuery<Doc> {
    let queryFilter: ObjectQuery<Doc> = {};

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

      const fieldName = this.convertFieldName(filter.field);

      queryFilter[fieldName] =
        _.isObject(generated) && !_.isArray(generated)
          ? { ...(queryFilter[fieldName] || {}), ...generated }
          : generated;
    });

    _.forEach(conditionalFilters ?? [], (filter) => {
      const generated = this.convertConditionalFilter(filter);

      if (generated === undefined) {
        return;
      }

      if (filter.key) {
        queryFilter[this.convertFieldName(filter.key)] = generated;
        return;
      }

      queryFilter = _.merge(queryFilter, generated);
    });

    console.log(queryFilter);
    return queryFilter;
  }

  stringify(entity: Doc): Entity {
    return wrap(entity).toJSON() as unknown as Entity;
  }

  stringifyMany(entities: Doc[]): Entity[] {
    return entities.map((entity) => this.stringify(entity));
  }
}
