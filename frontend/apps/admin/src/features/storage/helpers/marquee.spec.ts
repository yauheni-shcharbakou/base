import { getAutoScrollStep, getItemsInBox, isDrag, toBox } from './marquee';

describe('toBox', () => {
  it('spans the two points whichever way the drag went', () => {
    expect(toBox({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual({
      left: 10,
      top: 20,
      right: 50,
      bottom: 80,
    });
  });
});

describe('getItemsInBox', () => {
  const rects = [
    { id: 'a', left: 0, top: 0, right: 100, bottom: 50 },
    { id: 'b', left: 110, top: 0, right: 210, bottom: 50 },
    { id: 'c', left: 0, top: 60, right: 100, bottom: 110 },
  ];

  it('takes every item the box reaches, not only the ones it covers', () => {
    expect(getItemsInBox({ left: 90, top: 40, right: 120, bottom: 70 }, rects)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('takes none from the gaps between items', () => {
    expect(getItemsInBox({ left: 101, top: 51, right: 109, bottom: 59 }, rects)).toEqual([]);
  });
});

describe('isDrag', () => {
  it('reads a small move as a click', () => {
    expect(isDrag({ x: 0, y: 0 }, { x: 3, y: -3 })).toBe(false);
    expect(isDrag({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(true);
  });
});

describe('getAutoScrollStep', () => {
  it('stays put away from the edges', () => {
    expect(getAutoScrollStep(400, 0, 800)).toBe(0);
  });

  it('scrolls toward the edge the pointer is near, faster the closer', () => {
    expect(getAutoScrollStep(40, 0, 800)).toBeLessThan(0);
    expect(getAutoScrollStep(5, 0, 800)).toBeLessThan(getAutoScrollStep(40, 0, 800));
    expect(getAutoScrollStep(790, 0, 800)).toBeGreaterThan(getAutoScrollStep(760, 0, 800));
  });

  it('holds full speed past an edge', () => {
    expect(getAutoScrollStep(-200, 0, 800)).toBe(getAutoScrollStep(0, 0, 800));
    expect(getAutoScrollStep(1200, 0, 800)).toBe(getAutoScrollStep(800, 0, 800));
  });
});
