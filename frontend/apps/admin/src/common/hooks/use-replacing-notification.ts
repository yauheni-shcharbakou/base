import { OpenNotificationParams, useNotification } from '@refinedev/core';
import { useCallback } from 'react';

// Per tab, across components: a notification replaces its group's last one wherever it was opened.
const shownByGroup = new Map<string, string>();
let sequence = 0;

/**
 * Refine's notifications, one on screen per `key`. Refine's MUI provider hands `key` to notistack,
 * which renders every snackbar it holds under that key — one still showing, or still sliding out
 * after being closed — so opening a second under the same key rendered two children with one React
 * key (two quick visibility changes did). Here `key` names a group: its last notification closes,
 * and the new one gets a key of its own.
 */
export const useReplacingNotification = () => {
  const { open, close } = useNotification();

  return useCallback(
    (params: OpenNotificationParams & { key: string }) => {
      const previous = shownByGroup.get(params.key);

      if (previous) {
        close?.(previous);
      }

      const key = `${params.key}#${++sequence}`;
      shownByGroup.set(params.key, key);
      open?.({ ...params, key });
    },
    [open, close],
  );
};
