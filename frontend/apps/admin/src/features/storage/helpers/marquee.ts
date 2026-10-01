import type { ItemRect } from './folder-selection';

export type Point = { x: number; y: number };

export type MarqueeBox = Omit<ItemRect, 'id'>;

/** The box between where a drag started and where the pointer is, whichever way it went. */
export const toBox = (start: Point, end: Point): MarqueeBox => ({
  left: Math.min(start.x, end.x),
  top: Math.min(start.y, end.y),
  right: Math.max(start.x, end.x),
  bottom: Math.max(start.y, end.y),
});

const intersects = (a: MarqueeBox, b: MarqueeBox) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** The items a selection box touches — Drive selects an item as soon as the box reaches it. */
export const getItemsInBox = (box: MarqueeBox, rects: ItemRect[]): string[] =>
  rects.filter((rect) => intersects(box, rect)).map(({ id }) => id);

// Under it a press is a click, not the start of a box: a hand never holds perfectly still.
const DRAG_THRESHOLD_PX = 4;

export const isDrag = (start: Point, end: Point): boolean =>
  Math.abs(end.x - start.x) > DRAG_THRESHOLD_PX || Math.abs(end.y - start.y) > DRAG_THRESHOLD_PX;

// How close to an edge of the scrolled area the pointer starts scrolling it, and how fast at most.
const AUTO_SCROLL_EDGE_PX = 48;
const AUTO_SCROLL_MAX_STEP_PX = 20;

/**
 * How far a selection box scrolls the area it is in on one frame, with the pointer at `y` over an
 * area from `top` to `bottom`: toward the edge the pointer is near, the faster the closer it gets —
 * past the edge at full speed. Zero away from both edges.
 */
export const getAutoScrollStep = (y: number, top: number, bottom: number): number => {
  const speed = (depth: number) =>
    Math.ceil(AUTO_SCROLL_MAX_STEP_PX * Math.min(1, depth / AUTO_SCROLL_EDGE_PX));

  if (y < top + AUTO_SCROLL_EDGE_PX) {
    return -speed(top + AUTO_SCROLL_EDGE_PX - y);
  }

  if (y > bottom - AUTO_SCROLL_EDGE_PX) {
    return speed(y - (bottom - AUTO_SCROLL_EDGE_PX));
  }

  return 0;
};
