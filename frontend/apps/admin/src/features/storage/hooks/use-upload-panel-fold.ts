'use client';

import { useEffect, useSyncExternalStore } from 'react';

// How many things on screen want the corner the upload box sits in. Outside React, as the queue is:
// the box is mounted once in the layout, far from whatever asks.
let folds = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const change = (by: number) => {
  folds += by;
  listeners.forEach((listener) => listener());
};

const getIsFolded = () => folds > 0;
const getNotFolded = () => false;

/**
 * Folds the upload box (`StorageUploadPanel`) down to its header while `isActive`: the full-screen
 * viewer asks, whose stage — and the buttons on it — the open box would cover.
 */
export const useFoldUploadPanel = (isActive: boolean) => {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    change(1);
    return () => change(-1);
  }, [isActive]);
};

/** Whether something on screen has the upload box folded. */
export const useIsUploadPanelFolded = () =>
  useSyncExternalStore(subscribe, getIsFolded, getNotFolded);
