// How each named shortcut is written: as a Mac prints it, and as any other keyboard does.
const SHORTCUT_LABELS = {
  newFolder: ['⇧F', 'Shift+F'],
  open: ['↵', 'Enter'],
  rename: ['F2', 'F2'],
  // ⌘⌫ and Delete both delete; a keyboard with no ⌘ is told of the key it has.
  delete: ['⌘⌫', 'Del'],
  selectAll: ['⌘A', 'Ctrl+A'],
  goUp: ['⌘↑', 'Ctrl+↑'],
} as const;

export type ShortcutName = keyof typeof SHORTCUT_LABELS;

/** Whether `platform` (`navigator.platform`, or `userAgentData.platform`) is Apple's: its keys are ⌘ and ⌫. */
export const isApplePlatform = (platform: string) => /mac|iphone|ipad|ipod/i.test(platform);

/** A shortcut as the viewer's keyboard prints it — the handlers take ⌘ and Ctrl alike. */
export const getShortcutLabel = (name: ShortcutName, isApple: boolean): string =>
  SHORTCUT_LABELS[name][isApple ? 0 : 1];
