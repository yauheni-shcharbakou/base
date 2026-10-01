import type { MouseEvent as ReactMouseEvent } from 'react';
import { openOwnMenu, passRightClickOn } from './context-menu';

// The suite runs on node, with no DOM: an element here is no more than the handlers ask of one.
class FakeElement {
  readonly dispatchEvent = jest.fn();

  constructor(
    private readonly parent?: FakeElement,
    private readonly role?: string,
    private readonly corner = { left: 0, top: 0 },
  ) {}

  contains(other: FakeElement): boolean {
    return other === this || (!!other.parent && this.contains(other.parent));
  }

  closest(selector: string): FakeElement | null {
    return selector === `[role="${this.role}"]` ? this : (this.parent?.closest(selector) ?? null);
  }

  getBoundingClientRect() {
    return this.corner;
  }
}

class FakeMouseEvent {
  constructor(
    readonly type: string,
    readonly init: object,
  ) {}
}

const rightClick = (
  currentTarget: FakeElement,
  target: FakeElement,
  point = { clientX: 0, clientY: 0 },
) => {
  const event = {
    currentTarget,
    target,
    ...point,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  };

  return { event, reactEvent: event as unknown as ReactMouseEvent };
};

describe('openOwnMenu', () => {
  const card = new FakeElement(undefined, undefined, { left: 40, top: 60 });
  const name = new FakeElement(card);

  it('opens the menu at the pointer, in place of the browser’s and of any around it', () => {
    const open = jest.fn();
    const { event, reactEvent } = rightClick(card, name, { clientX: 120, clientY: 80 });

    openOwnMenu(open)(reactEvent);

    expect(open).toHaveBeenCalledWith({ left: 120, top: 80 });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('opens at the corner of the element when the keyboard asked, which names no point', () => {
    const open = jest.fn();

    openOwnMenu(open)(rightClick(card, card).reactEvent);

    expect(open).toHaveBeenCalledWith({ left: 40, top: 60 });
  });

  it('leaves alone a right click made in a menu the element has open', () => {
    const open = jest.fn();
    // A portal: the card's in React's tree, not in the DOM's.
    const menuEntry = new FakeElement(new FakeElement());
    const { event, reactEvent } = rightClick(card, menuEntry, { clientX: 120, clientY: 80 });

    openOwnMenu(open)(reactEvent);

    expect(open).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });
});

describe('passRightClickOn', () => {
  const root = new FakeElement();
  const backdrop = new FakeElement(root);
  const entry = new FakeElement(new FakeElement(root, 'menu'));
  const content = new FakeElement();
  const card = new FakeElement(content);
  const elementsFromPoint = jest.fn();
  const point = { clientX: 300, clientY: 200 };

  beforeAll(() => {
    Object.assign(globalThis, { document: { elementsFromPoint }, MouseEvent: FakeMouseEvent });
  });

  afterAll(() => {
    Object.assign(globalThis, { document: undefined, MouseEvent: undefined });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shuts the menu, then makes the click again on what lies under its backdrop', () => {
    const close = jest.fn();
    const { event, reactEvent } = rightClick(root, backdrop, point);
    elementsFromPoint.mockReturnValue([backdrop, root, card, content]);

    passRightClickOn(close)(reactEvent);

    expect(elementsFromPoint).toHaveBeenCalledWith(300, 200);
    expect(card.dispatchEvent).toHaveBeenCalledWith(
      new FakeMouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, ...point }),
    );
    expect(content.dispatchEvent).not.toHaveBeenCalled();
    // The menu opened there must be the last word: a close after it would shut it again.
    expect(close.mock.invocationCallOrder[0]).toBeLessThan(
      card.dispatchEvent.mock.invocationCallOrder[0],
    );
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('only shuts the menu when nothing lies under its backdrop', () => {
    const close = jest.fn();
    elementsFromPoint.mockReturnValue([backdrop, root]);

    passRightClickOn(close)(rightClick(root, backdrop, point).reactEvent);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does nothing on the menu itself, but keep the browser’s own menu away', () => {
    const close = jest.fn();
    const { event, reactEvent } = rightClick(root, entry, point);
    elementsFromPoint.mockReturnValue([entry, root, card, content]);

    passRightClickOn(close)(reactEvent);

    expect(close).not.toHaveBeenCalled();
    expect(card.dispatchEvent).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });
});
