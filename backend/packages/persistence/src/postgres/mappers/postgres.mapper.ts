import { NestCommon } from '@backend/proto';
import { FilterObject, ObjectQuery, wrap } from '@mikro-orm/core';
import { DatabaseRepositoryGetList, QueryOf } from 'common';
import _ from 'lodash';
import { PostgresEntity } from 'postgres/entities';
import { PostgresSorting } from 'postgres/postgres.types';
import { OperatorMap } from '@mikro-orm/core/typings';

interface ParsedLogicalFilter extends Omit<
  NestCommon.CrudLogicalFilter,
  'string' | 'number' | 'boolean'
> {
  value?: any;
}

type FilterConverter = (
  filter: ParsedLogicalFilter,
) => Partial<OperatorMap<any>> | FilterObject<any>[string];

export class PostgresMapper<
  Doc extends PostgresEntity<any>,
  Entity extends NestCommon.EntityWithTimestamps,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
> {
  constructor(protected readonly fieldNameConverter: Record<string, keyof Doc | string> = {}) {}

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

  protected readonly converterByFilter: Map<NestCommon.CrudLogicalOperator, FilterConverter> =
    new Map([
      [
        NestCommon.CrudLogicalOperator.eq,
        ({ value }) => (_.isString(value) ? { $re: `^${value}$` } : value),
      ],

      [NestCommon.CrudLogicalOperator.eqs, ({ value }) => value],
      [
        NestCommon.CrudLogicalOperator.ne,
        ({ value }) => (_.isString(value) ? { $not: { $re: `^${value}$` } } : { $ne: value }),
      ],
      [NestCommon.CrudLogicalOperator.nes, ({ value }) => ({ $ne: value })],

      [NestCommon.CrudLogicalOperator.gt, ({ value }) => ({ $gt: value })],
      [NestCommon.CrudLogicalOperator.gte, ({ value }) => ({ $gte: value })],
      [NestCommon.CrudLogicalOperator.lt, ({ value }) => ({ $lt: value })],
      [NestCommon.CrudLogicalOperator.lte, ({ value }) => ({ $lte: value })],

      [NestCommon.CrudLogicalOperator.in, ({ value }) => ({ $in: _.castArray(value) })],
      [NestCommon.CrudLogicalOperator.nin, ({ value }) => ({ $nin: _.castArray(value) })],

      [NestCommon.CrudLogicalOperator.contains, ({ value }) => ({ $ilike: `%${value}%` })],
      [NestCommon.CrudLogicalOperator.containss, ({ value }) => ({ $like: `%${value}%` })],
      [NestCommon.CrudLogicalOperator.startswith, ({ value }) => ({ $ilike: `${value}%` })],
      [NestCommon.CrudLogicalOperator.startswiths, ({ value }) => ({ $like: `${value}%` })],
      [NestCommon.CrudLogicalOperator.endswith, ({ value }) => ({ $ilike: `%${value}` })],
      [NestCommon.CrudLogicalOperator.endswiths, ({ value }) => ({ $like: `%${value}` })],

      [
        NestCommon.CrudLogicalOperator.between,
        ({ value }) => {
          if (_.isArray(value)) {
            return { $gte: value[0], $lte: value[1] };
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

    const operator = filter.operator === NestCommon.CrudConditionalOperator.or ? '$or' : '$and';

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

  transformSorters(sorters: NestCommon.CrudSorter[] = []): PostgresSorting[] {
    return _.map(sorters, (sorter): PostgresSorting => {
      return { [sorter.field]: sorter.order === NestCommon.CrudSort.desc ? 'DESC' : 'ASC' };
    });
  }

  transformQuery({ ids, ...rest }: Partial<Query>): ObjectQuery<Doc> {
    const result = _.omitBy(rest, _.isNil) as ObjectQuery<NestCommon.IdField>;

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

    return queryFilter;
  }

  stringify(entity: Doc): Entity {
    return wrap(entity).toJSON() as unknown as Entity;
  }

  stringifyMany(entities: Doc[]): Entity[] {
    return entities.map((entity) => this.stringify(entity));
  }
}
