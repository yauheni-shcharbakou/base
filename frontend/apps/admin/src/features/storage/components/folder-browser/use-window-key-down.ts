import { useEffect, useRef } from 'react';

/**
 * Keys belong to what has focus when it is a field, an open menu, a confirmation, or a dialog that
 * keeps its keys (`data-keeps-keys` — not every dialog does: the gallery's viewer is one too).
 */
export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    !!target.closest(
      'input, textarea, select, [role="menu"], [role="listbox"], [role="alertdialog"], [data-keeps-keys]',
    ));

/** Enter and Space already press a focused control. */
export const isControl = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest('button, a, [role="button"]');

/**
 * A page-wide shortcut handler: one listener for the component's lifetime, calling the latest
 * handler, so the handler may close over fresh state without re-subscribing on every render.
 */
export const useWindowKeyDown = (handler: (event: KeyboardEvent) => void) => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handlerRef.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
};
