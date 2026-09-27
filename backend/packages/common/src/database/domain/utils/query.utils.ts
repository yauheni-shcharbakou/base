import _ from 'lodash';

/**
 * Whether a query constrains nothing: every value is `null`/`undefined` or an empty array. The gRPC
 * loader fills an unset `repeated` field with `[]`, so a client that sends no filter arrives as
 * `{ ids: [] }`, which the mappers drop to `{}` — a bulk write over every row.
 *
 * For a layer that has no mapper to ask, such as a use-case that reads the rows before writing
 * them. The repositories check the query their mapper produced instead, which also sees a field the
 * mapper drops for another reason.
 */
export const isUnfilteredQuery = (query: object | undefined): boolean =>
  _.every(
    _.values(query ?? {}),
    (value: unknown) => _.isNil(value) || (Array.isArray(value) && !value.length),
  );
