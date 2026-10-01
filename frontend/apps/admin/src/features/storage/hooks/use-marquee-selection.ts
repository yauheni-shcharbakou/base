import {
  getAutoScrollStep,
  getItemsInBox,
  isDrag,
  ItemRect,
  MarqueeBox,
  Point,
  toBox,
} from '@/features/storage/helpers';
import { PointerEvent, RefObject, useCallback, useEffect, useRef, useState } from 'react';

/** The attribute every selectable item of a folder view carries, with its id. */
export const ITEM_ID_ATTRIBUTE = 'data-item-id';

/** Where each item of `container` is on screen now, in the order they show. */
export const readItemRects = (container: HTMLElement | null): ItemRect[] =>
  Array.from(container?.querySelectorAll<HTMLElement>(`[${ITEM_ID_ATTRIBUTE}]`) ?? []).map(
    (element) => {
      const { left, top, right, bottom } = element.getBoundingClientRect();
      return { id: element.getAttribute(ITEM_ID_ATTRIBUTE) as string, left, top, right, bottom };
    },
  );

type Options = {
  selectedIds: ReadonlySet<string>;
  onSelect: (ids: string[]) => void;
  onClear: () => void;
};

type Drag = {
  // Where the press was, in the container's own coordinates: they hold while the page scrolls.
  origin: Point;
  // Where the pointer is on screen, and where it was pressed.
  pointer: Point;
  pressed: Point;
  base: string[];
  isDragging: boolean;
  // The ids the box selected last, so a frame that changes nothing selects nothing.
  hitKey?: string;
  scroller: HTMLElement;
  frame?: number;
};

// A press here is the item's own, or a control's.
const INTERACTIVE = `[${ITEM_ID_ATTRIBUTE}], button, a, input, [role="menu"], [role="button"]`;

const isScrollable = (element: HTMLElement) =>
  /(auto|scroll|overlay)/.test(getComputedStyle(element).overflowY) &&
  element.scrollHeight > element.clientHeight;

// The nearest ancestor that scrolls, else the page.
const getScroller = (element: HTMLElement): HTMLElement => {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node !== document.body && node !== document.documentElement && isScrollable(node)) {
      return node;
    }
  }

  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
};

// The part of the screen a scroller shows.
const getViewport = (scroller: HTMLElement) => {
  if (scroller === document.scrollingElement || scroller === document.documentElement) {
    return { top: 0, bottom: window.innerHeight };
  }

  const { top, bottom } = scroller.getBoundingClientRect();
  return { top: Math.max(top, 0), bottom: Math.min(bottom, window.innerHeight) };
};

/**
 * Drive's selection box: a press on the empty space of `container` and a drag select every item
 * the box touches — added to the selection with ⌘ or Shift held. A press without a drag clears the
 * selection, as a click on nothing does in Drive. Held near the top or the bottom of the screen, the
 * box scrolls the page and grows with it. Returns the box in the container's own coordinates, for
 * the overlay, and the handlers to put on the container.
 */
export const useMarqueeSelection = (
  container: RefObject<HTMLElement | null>,
  { selectedIds, onSelect, onClear }: Options,
) => {
  const [box, setBox] = useState<MarqueeBox>();
  const drag = useRef<Drag | undefined>(undefined);

  // Read by the animation frames, which outlive the render that scheduled them.
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  const draw = useCallback(() => {
    const current = drag.current;
    const element = container.current;

    if (!current || !element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const local = toBox(current.origin, {
      x: current.pointer.x - rect.left,
      y: current.pointer.y - rect.top,
    });
    // Drawn inside the container, as Drive keeps it inside the file area.
    const clipped = {
      left: Math.max(local.left, 0),
      top: Math.max(local.top, 0),
      right: Math.min(local.right, rect.width),
      bottom: Math.min(local.bottom, rect.height),
    };
    const hit = getItemsInBox(
      {
        left: clipped.left + rect.left,
        top: clipped.top + rect.top,
        right: clipped.right + rect.left,
        bottom: clipped.bottom + rect.top,
      },
      readItemRects(element),
    );
    const ids = Array.from(new Set(current.base.concat(hit)));
    const hitKey = ids.join(',');

    setBox(clipped);

    if (hitKey !== current.hitKey) {
      current.hitKey = hitKey;
      onSelectRef.current(ids);
    }
  }, [container]);

  // One frame of scrolling toward the edge the pointer holds near, while it holds there.
  const scroll = useCallback(() => {
    const current = drag.current;

    if (!current) {
      return;
    }

    const { top, bottom } = getViewport(current.scroller);
    const step = getAutoScrollStep(current.pointer.y, top, bottom);
    const before = current.scroller.scrollTop;

    if (step) {
      current.scroller.scrollTop = before + step;
    }

    // Stops at the end of the page as well as away from the edge.
    if (!step || current.scroller.scrollTop === before) {
      current.frame = undefined;
      return;
    }

    draw();
    current.frame = requestAnimationFrame(scroll);
  }, [draw]);

  const stop = useCallback(() => {
    const current = drag.current;
    drag.current = undefined;
    setBox(undefined);

    if (current?.frame !== undefined) {
      cancelAnimationFrame(current.frame);
    }

    return current;
  }, []);

  // A page left mid-drag leaves no frame running.
  useEffect(() => () => void stop(), [stop]);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const current = drag.current;

      if (!current) {
        return;
      }

      current.pointer = { x: event.clientX, y: event.clientY };

      if (!current.isDragging && !isDrag(current.pressed, current.pointer)) {
        return;
      }

      current.isDragging = true;
      draw();

      if (current.frame === undefined) {
        current.frame = requestAnimationFrame(scroll);
      }
    },
    [draw, scroll],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent) => {
      const current = stop();

      if (!current) {
        return;
      }

      (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);

      if (!current.isDragging && !current.base.length) {
        onClear();
      }
    },
    [stop, onClear],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      const element = container.current;

      // A press in a portal — an item's open menu, its backdrop — reaches here through React's
      // tree, not the DOM's: it belongs to that menu. Capturing it would keep its click from ever
      // closing the menu.
      if (event.button !== 0 || !element?.contains(target) || target.closest(INTERACTIVE)) {
        return;
      }

      const isAdditive = event.metaKey || event.ctrlKey || event.shiftKey;
      const rect = element.getBoundingClientRect();
      const pointer = { x: event.clientX, y: event.clientY };

      drag.current = {
        origin: { x: pointer.x - rect.left, y: pointer.y - rect.top },
        pointer,
        pressed: pointer,
        base: isAdditive ? Array.from(selectedIds) : [],
        isDragging: false,
        scroller: getScroller(element),
      };
      // Captured, so the drag goes on over the items and past the container's edge.
      element.setPointerCapture?.(event.pointerId);
      // No text selection from a drag over names.
      event.preventDefault();
    },
    [container, selectedIds],
  );

  return {
    box,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
};
