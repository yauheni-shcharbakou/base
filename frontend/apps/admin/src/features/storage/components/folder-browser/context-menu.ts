import type { MouseEvent as ReactMouseEvent } from 'react';

/** Where a menu opens by the pointer: the viewport's point a right click was made at. */
export type MenuPosition = { left: number; top: number };

// At the pointer — or, called from the keyboard, which names no point, at the corner of what has
// the focus.
const getContextMenuPosition = (event: ReactMouseEvent): MenuPosition => {
  if (event.clientX || event.clientY) {
    return { left: event.clientX, top: event.clientY };
  }

  const { left, top } = event.currentTarget.getBoundingClientRect();

  return { left, top };
};

/**
 * The `onContextMenu` of what has a menu of its own, which opens by the pointer in place of the
 * browser's — and of the menu of whatever lies around it. A right click made in a menu the element
 * has open is none of its own: a portal's events reach its owner through React's tree, not the
 * DOM's.
 */
export const openOwnMenu = (open: (position: MenuPosition) => void) => (event: ReactMouseEvent) => {
  if (!event.currentTarget.contains(event.target as Node)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  open(getContextMenuPosition(event));
};

/**
 * The `onContextMenu` of an open menu, which keeps the browser's own out of the way. A right click
 * beside the menu lands on its backdrop: it shuts the menu and is made again on what lies under the
 * backdrop, which opens its own menu there — Drive's second right click moves the menu. One on the
 * menu itself does nothing.
 */
export const passRightClickOn = (close: () => void) => (event: ReactMouseEvent) => {
  event.preventDefault();
  event.stopPropagation();

  if ((event.target as Element).closest('[role="menu"]')) {
    return;
  }

  const { clientX, clientY, currentTarget } = event;
  const below = document
    .elementsFromPoint(clientX, clientY)
    .find((element) => !currentTarget.contains(element));

  close();
  below?.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY, button: 2 }),
  );
};
