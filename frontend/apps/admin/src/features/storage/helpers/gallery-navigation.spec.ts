import { getNeighbourId, pickArrival, stepFiles, stepGallery } from './gallery-navigation';

const at = (index: number, page = 1, pageCount = 1, count = 5) => ({
  index,
  count,
  page,
  pageCount,
});

describe('stepGallery', () => {
  it('moves within the page', () => {
    expect(stepGallery(at(2), 'next')).toEqual({ index: 3 });
    expect(stepGallery(at(2), 'prev')).toEqual({ index: 1 });
  });

  it('crosses into the neighbouring page at an edge', () => {
    expect(stepGallery(at(4, 1, 3), 'next')).toEqual({ page: 2, edge: 'first' });
    expect(stepGallery(at(0, 2, 3), 'prev')).toEqual({ page: 1, edge: 'last' });
  });

  it('stops at the ends of the folder', () => {
    expect(stepGallery(at(4, 3, 3), 'next')).toBeNull();
    expect(stepGallery(at(0, 1, 3), 'prev')).toBeNull();
  });

  it('jumps to the first and last item of the whole folder', () => {
    expect(stepGallery(at(3, 2, 3), 'first')).toEqual({ page: 1, edge: 'first' });
    expect(stepGallery(at(3, 2, 3), 'last')).toEqual({ page: 3, edge: 'last' });
    expect(stepGallery(at(3), 'first')).toEqual({ index: 0 });
    expect(stepGallery(at(3), 'last')).toEqual({ index: 4 });
    expect(stepGallery(at(0), 'first')).toBeNull();
  });

  it('selects the first item when nothing is selected', () => {
    expect(stepGallery(at(-1), 'next')).toEqual({ index: 0 });
    expect(stepGallery(at(-1), 'prev')).toEqual({ index: 0 });
  });

  it('does nothing in an empty folder', () => {
    expect(stepGallery(at(-1, 1, 1, 0), 'next')).toBeNull();
  });
});

describe('getNeighbourId', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('takes the next item, or the previous one at the end', () => {
    expect(getNeighbourId(items, 'b')).toBe('c');
    expect(getNeighbourId(items, 'c')).toBe('b');
  });

  it('gives nothing for the last item left or an unknown one', () => {
    expect(getNeighbourId([{ id: 'a' }], 'a')).toBeUndefined();
    expect(getNeighbourId(items, 'z')).toBeUndefined();
  });
});

const folder = (id: string) => ({ id, isFolder: true });
const file = (id: string) => ({ id });

describe('stepFiles', () => {
  const items = [folder('a'), folder('b'), file('c'), file('d')];
  const on = (index: number, page = 1, pageCount = 1) => ({
    index,
    count: items.length,
    page,
    pageCount,
  });

  it('steps over the files as the gallery does', () => {
    expect(stepFiles(on(2), 'next', items)).toEqual({ index: 3 });
    expect(stepFiles(on(3), 'prev', items)).toEqual({ index: 2 });
    expect(stepFiles(on(3, 1, 2), 'next', items)).toEqual({ page: 2, edge: 'first' });
  });

  it('stops at the folders', () => {
    expect(stepFiles(on(2), 'prev', items)).toBeNull();
  });

  it('jumps home to the first file', () => {
    expect(stepFiles(on(3), 'first', items)).toEqual({ index: 2 });
    expect(stepFiles(on(2), 'first', items)).toBeNull();
    expect(stepFiles(on(3, 2, 2), 'first', items)).toEqual({ page: 1, edge: 'first' });
  });

  it('crosses back to the previous page, for the arrival to settle', () => {
    expect(stepFiles(on(0, 2, 2), 'prev', [file('x')])).toEqual({ page: 1, edge: 'last' });
  });
});

describe('pickArrival', () => {
  it('lands on either end of any item', () => {
    expect(pickArrival([folder('a'), file('b')], 'first', false)).toEqual({ index: 0 });
    expect(pickArrival([file('a'), folder('b')], 'last', false)).toEqual({ index: 1 });
  });

  it('lands on the first file, or goes on past a page of folders', () => {
    expect(pickArrival([folder('a'), file('b')], 'first', true)).toEqual({ index: 1 });
    expect(pickArrival([folder('a'), folder('b')], 'first', true)).toEqual({ page: 'next' });
  });

  it('turns back from a page that ends in folders', () => {
    expect(pickArrival([folder('a'), folder('b')], 'last', true)).toBeNull();
    expect(pickArrival([folder('a'), file('b')], 'last', true)).toEqual({ index: 1 });
  });

  it('has nothing to land on in an empty page', () => {
    expect(pickArrival([], 'first', true)).toBeNull();
  });
});
