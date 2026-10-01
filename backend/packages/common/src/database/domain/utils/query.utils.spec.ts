import { isUnfilteredQuery } from './query.utils';

describe('isUnfilteredQuery', () => {
  it.each([
    ['no query', undefined],
    ['an empty query', {}],
    ["a client's empty filter", { ids: [], roles: [] }],
    ['only unset fields', { id: undefined, email: null }],
  ])('treats %s as unfiltered', (_name, query) => {
    expect(isUnfilteredQuery(query)).toBe(true);
  });

  it.each([
    ['an id list', { ids: ['a'] }],
    ['a scalar', { email: 'a@b.c' }],
    ['a false flag', { isDeleted: false }],
    ['an empty string', { name: '' }],
  ])('treats %s as a filter', (_name, query) => {
    expect(isUnfilteredQuery(query)).toBe(false);
  });
});
