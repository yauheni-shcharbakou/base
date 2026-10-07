import { DatabaseRepositoryGetList, QueryOf } from '@backend/common';
import { NestCommon } from '@backend/proto';
import { ObjectQuery, serialize } from '@mikro-orm/core';
import _ from 'lodash';
import { PgEntity } from '../entities';
import { PgSorting } from '../types';

interface ParsedLogicalFilter extends Omit<
  NestCommon.LogicalFilter,
  'string' | 'number' | 'boolean'
> {
  value?: any;
}

type FilterConverter = (filter: ParsedLogicalFilter) => ObjectQuery<any>[string];

export class PgMapper<
  Doc extends PgEntity<any>,
  Entity extends NestCommon.Entity,
  Query extends QueryOf<Entity> = QueryOf<Entity>,
> {
  constructor(protected readonly fieldNameConverter: Record<string, keyof Doc | string> = {}) {}

  /**
   * Relations serialized as objects where the read loaded them, at any depth (`file`, `file.image`);
   * every other relation is its key. A lazy scalar (a `{ lazy: true }` formula) needs no entry: it is
   * serialized wherever the read loaded it.
   */
  protected readonly populate: readonly string[] = [];

  /** Properties left out, at any depth (`file.storageObject`). An excluded one is never visited. */
  protected readonly exclude: readonly string[] = [];

  protected readonly additionalFilterConverters: [NestCommon.LogicalOperator, FilterConverter][] =
    [];

  /**
   * Filter fields that are not a column of their own, keyed by the field a client sends. Each one
   * turns the operator's output into the condition to merge into the query — a relation's
   * existence, or a column of a related row. `undefined` drops the filter.
   */
  protected readonly computedFilters: Record<
    string,
    (generated: unknown) => ObjectQuery<Doc> | undefined
  > = {};

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

  protected readonly converterByFilter: Map<NestCommon.LogicalOperator, FilterConverter> = new Map([
    [
      NestCommon.LogicalOperator.eq,
      ({ value }) => (_.isString(value) ? { $re: `^${value}$` } : value),
    ],

    [NestCommon.LogicalOperator.eqs, ({ value }) => value],
    [
      NestCommon.LogicalOperator.ne,
      ({ value }) => (_.isString(value) ? { $not: { $re: `^${value}$` } } : { $ne: value }),
    ],
    [NestCommon.LogicalOperator.nes, ({ value }) => ({ $ne: value })],

    [NestCommon.LogicalOperator.gt, ({ value }) => ({ $gt: value })],
    [NestCommon.LogicalOperator.gte, ({ value }) => ({ $gte: value })],
    [NestCommon.LogicalOperator.lt, ({ value }) => ({ $lt: value })],
    [NestCommon.LogicalOperator.lte, ({ value }) => ({ $lte: value })],

    [NestCommon.LogicalOperator.in, ({ value }) => ({ $in: _.castArray(value) })],
    [NestCommon.LogicalOperator.nin, ({ value }) => ({ $nin: _.castArray(value) })],

    [NestCommon.LogicalOperator.contains, ({ value }) => ({ $ilike: `%${value}%` })],
    [NestCommon.LogicalOperator.containss, ({ value }) => ({ $like: `%${value}%` })],
    [NestCommon.LogicalOperator.startswith, ({ value }) => ({ $ilike: `${value}%` })],
    [NestCommon.LogicalOperator.startswiths, ({ value }) => ({ $like: `${value}%` })],
    [NestCommon.LogicalOperator.endswith, ({ value }) => ({ $ilike: `%${value}` })],
    [NestCommon.LogicalOperator.endswiths, ({ value }) => ({ $like: `%${value}` })],

    [
      NestCommon.LogicalOperator.between,
      ({ value }) => {
        if (_.isArray(value)) {
          return { $gte: value[0], $lte: value[1] };
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

    const operator = filter.operator === NestCommon.ConditionalOperator.or ? '$or' : '$and';

    return {
      [operator]: _.reduce(
        filter.value,
        (acc: any[], logicalFilter) => {
          const parsedFilter = this.parseLogicalFilter(logicalFilter);
          const converter = this.converterByFilter.get(logicalFilter.operator);
          const generated = converter(parsedFilter);

          if (generated !== undefined) {
            acc.push(generated);
          }

          return acc;
        },
        [],
      ),
    };
  }

  /**
   * The entity properties a list's filters and sorts name, as the query will use them — a
   * `computedFilters` field names none of its own. The repository checks them against the entity
   * before querying: MikroORM refuses an unknown one with a plain `Error`, indistinguishable from
   * any other failure.
   */
  listFields({
    logicalFilters,
    conditionalFilters,
    sorters,
  }: DatabaseRepositoryGetList<Query>): string[] {
    const filtered = _.map(
      _.reject(logicalFilters ?? [], (filter) => filter.field in this.computedFilters),
      (filter) => this.convertFieldName(filter.field),
    );
    const keyed = _.map(
      _.filter(conditionalFilters ?? [], (filter) => !!filter.key),
      (filter) => this.convertFieldName(filter.key),
    );

    return _.uniq([...filtered, ...keyed, ..._.map(sorters ?? [], 'field')]);
  }

  transformSorters(sorters: NestCommon.Sorter[] = []): PgSorting[] {
    return _.map(sorters, (sorter): PgSorting => {
      return { [sorter.field]: sorter.order === NestCommon.Sort.desc ? 'DESC' : 'ASC' };
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

      const computed = this.computedFilters[filter.field];

      if (computed) {
        const condition = computed(generated);

        if (condition !== undefined) {
          queryFilter = _.merge(queryFilter, condition);
        }

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

  /**
   * The row as the contract carries it: relations as keys, except the ones `populate` names. Not
   * `toJSON`, which expands every relation the identity map happens to hold, so that the answer
   * depended on what else the request had loaded: a leaf reached its folder and every sibling there
   * (n², then out of memory), a temp code its user with the password hash.
   */
  stringify(entity: Doc): Entity {
    // The paths are checked against nothing: a relation typed as a proto message has none past it.
    return serialize(entity, {
      populate: [...this.populate],
      exclude: [...this.exclude],
    } as never) as unknown as Entity;
  }

  stringifyMany(entities: Doc[]): Entity[] {
    return entities.map((entity) => this.stringify(entity));
  }
}
