import {
  capSelection,
  clickSelection,
  deselectAll,
  EMPTY_SELECTION,
  FolderSelection,
  focusOnly,
  getArrowTargetId,
  ItemRect,
  pruneSelection,
  removeFromSelection,
  selectAll,
  selectOnly,
  stepSelection,
  toggleSelection,
} from './folder-selection';

const order = ['a', 'b', 'c', 'd', 'e'];

const ids = (selection: FolderSelection) => Array.from(selection.ids).sort();

describe('focusOnly', () => {
  it('marks the folder just left for the keyboard without selecting it', () => {
    const marked = focusOnly('b');

    expect(ids(marked)).toEqual([]);
    expect(marked.focus).toBe('b');
  });

  it('lets a checkbox or a ⌘-click start the selection without the marked folder', () => {
    expect(ids(toggleSelection(focusOnly('b'), 'd'))).toEqual(['d']);
    expect(ids(clickSelection(focusOnly('b'), 'd', order, { toggle: true }))).toEqual(['d']);
  });

  it('extends a Shift-arrow from the marked folder', () => {
    expect(ids(stepSelection(focusOnly('b'), 'c', order, true))).toEqual(['b', 'c']);
  });
});

describe('clickSelection', () => {
  it('selects only the item on a plain click', () => {
    const selection = clickSelection({ ids: new Set(['a', 'b']), anchor: 'a' }, 'c', order);

    expect(ids(selection)).toEqual(['c']);
    expect(selection.anchor).toBe('c');
    expect(selection.focus).toBe('c');
  });

  it('adds and takes an item with ⌘, which moves the anchor', () => {
    const added = clickSelection(selectOnly('a'), 'c', order, { toggle: true });
    const taken = clickSelection(added, 'a', order, { toggle: true });

    expect(ids(added)).toEqual(['a', 'c']);
    expect(ids(taken)).toEqual(['c']);
    expect(taken.anchor).toBe('a');
  });

  it('selects the range from the anchor with Shift, either way, keeping the anchor', () => {
    const down = clickSelection(selectOnly('b'), 'd', order, { range: true });
    const up = clickSelection(down, 'a', order, { range: true });

    expect(ids(down)).toEqual(['b', 'c', 'd']);
    expect(ids(up)).toEqual(['a', 'b']);
    expect(up.anchor).toBe('b');
    expect(up.focus).toBe('a');
  });

  it('adds the range to the selection with ⌘ and Shift', () => {
    const selection = clickSelection({ ids: new Set(['a', 'e']), anchor: 'b' }, 'c', order, {
      range: true,
      toggle: true,
    });

    expect(ids(selection)).toEqual(['a', 'b', 'c', 'e']);
  });

  it('selects only the item on Shift with nothing to extend from', () => {
    expect(ids(clickSelection(EMPTY_SELECTION, 'c', order, { range: true }))).toEqual(['c']);
  });
});

describe('toggleSelection', () => {
  it('adds and takes one item, as ⌘-click does', () => {
    expect(ids(toggleSelection(selectOnly('a'), 'b'))).toEqual(['a', 'b']);
    expect(ids(toggleSelection(selectOnly('a'), 'a'))).toEqual([]);
  });
});

describe('selectAll', () => {
  it('selects the whole page, keeping where the keyboard is', () => {
    const selection = selectAll(selectOnly('c'), order);

    expect(ids(selection)).toEqual(order);
    expect(selection.focus).toBe('c');
  });

  it('adds the page to what other pages have selected', () => {
    expect(ids(selectAll(selectOnly('x'), order))).toEqual([...order, 'x']);
  });
});

describe('deselectAll', () => {
  it('takes the page out and leaves other pages selected', () => {
    const selection = deselectAll({ ids: new Set(['a', 'b', 'x']), anchor: 'a' }, order);

    expect(ids(selection)).toEqual(['x']);
    expect(selection.anchor).toBeUndefined();
  });
});

describe('removeFromSelection', () => {
  it('drops the items, and the anchor and focus on them', () => {
    const selection = removeFromSelection({ ids: new Set(['a', 'b']), anchor: 'a', focus: 'b' }, [
      'a',
    ]);

    expect(ids(selection)).toEqual(['b']);
    expect(selection.anchor).toBeUndefined();
    expect(selection.focus).toBe('b');
  });
});

describe('stepSelection', () => {
  it('moves the selection to the item', () => {
    expect(ids(stepSelection(selectOnly('b'), 'c', order, false))).toEqual(['c']);
  });

  it('extends from the anchor with Shift, and shrinks back', () => {
    const grown = stepSelection(selectOnly('b'), 'd', order, true);
    const shrunk = stepSelection(grown, 'c', order, true);

    expect(ids(grown)).toEqual(['b', 'c', 'd']);
    expect(ids(shrunk)).toEqual(['b', 'c']);
  });
});

describe('pruneSelection', () => {
  it('keeps the anchor and the focus on the page, and every item selected elsewhere', () => {
    const selection = pruneSelection({ ids: new Set(['a', 'x']), anchor: 'x', focus: 'a' }, order);

    expect(ids(selection)).toEqual(['a', 'x']);
    expect(selection.anchor).toBeUndefined();
    expect(selection.focus).toBe('a');
  });

  it('returns the same selection when nothing is gone', () => {
    const selection = selectOnly('a');

    expect(pruneSelection(selection, order)).toBe(selection);
  });
});

describe('getArrowTargetId', () => {
  const rect = (id: string, left: number, top: number, width = 100, height = 50): ItemRect => ({
    id,
    left,
    top,
    right: left + width,
    bottom: top + height,
  });

  // Two folders in a row of 200px cards, then three files in a row of 100px cards.
  const rects = [
    rect('f1', 0, 0, 200),
    rect('f2', 210, 0, 200),
    rect('a', 0, 100),
    rect('b', 110, 100),
    rect('c', 220, 100),
  ];

  it('follows the page order left and right, across rows', () => {
    expect(getArrowTargetId(rects, 'f2', 'right')).toBe('a');
    expect(getArrowTargetId(rects, 'a', 'left')).toBe('f2');
    expect(getArrowTargetId(rects, 'c', 'right')).toBeUndefined();
  });

  it('goes to the nearest item across in the row below or above', () => {
    expect(getArrowTargetId(rects, 'f2', 'down')).toBe('c');
    expect(getArrowTargetId(rects, 'f1', 'down')).toBe('a');
    expect(getArrowTargetId(rects, 'b', 'up')).toBe('f1');
  });

  it('stops at the top and bottom rows', () => {
    expect(getArrowTargetId(rects, 'f1', 'up')).toBeUndefined();
    expect(getArrowTargetId(rects, 'b', 'down')).toBeUndefined();
  });

  it('starts at the first item when none has the keyboard', () => {
    expect(getArrowTargetId(rects, undefined, 'down')).toBe('f1');
  });
});

describe('capSelection', () => {
  const selection = (selected: string[], focus?: string): FolderSelection => ({
    ids: new Set(selected),
    anchor: selected[0],
    focus,
  });

  it('leaves a selection within the limit alone', () => {
    const next = selection(['a', 'b', 'c']);

    expect(capSelection(EMPTY_SELECTION, next, 3)).toEqual({ selection: next, isCapped: false });
  });

  it('keeps what was selected and takes the new items in order until it is full', () => {
    const { selection: capped, isCapped } = capSelection(
      selection(['d']),
      selection(['a', 'b', 'c', 'd', 'e'], 'e'),
      3,
    );

    expect(isCapped).toBe(true);
    expect(Array.from(capped.ids)).toEqual(['d', 'a', 'b']);
    // The keyboard stays where it went.
    expect(capped.focus).toBe('e');
    expect(capped.anchor).toBe('a');
  });

  it('adds nothing to a selection that is full already', () => {
    const { selection: capped, isCapped } = capSelection(
      selection(['a', 'b']),
      selectAll(selection(['a', 'b']), order),
      2,
    );

    expect(isCapped).toBe(true);
    expect(ids(capped)).toEqual(['a', 'b']);
  });

  it('lets a full selection shrink', () => {
    const full = selection(['a', 'b']);
    const next = toggleSelection(full, 'a');

    expect(capSelection(full, next, 2)).toEqual({ selection: next, isCapped: false });
  });
});
