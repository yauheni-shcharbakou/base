import { getNeighbourId, stepGallery } from './gallery-navigation';

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
