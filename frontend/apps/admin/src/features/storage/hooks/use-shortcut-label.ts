import { getShortcutLabel, isApplePlatform, ShortcutName } from '@/features/storage/helpers';
import { useCallback, useSyncExternalStore } from 'react';

type NavigatorWithUserAgentData = Navigator & { userAgentData?: { platform?: string } };

// The platform never changes under a page: nothing to subscribe to.
const subscribe = () => () => {};

const getIsApple = () => {
  const { userAgentData, platform } = navigator as NavigatorWithUserAgentData;

  return isApplePlatform(userAgentData?.platform || platform);
};

// The server cannot know the keyboard. A Mac's labels stand until the browser says otherwise — read
// through `useSyncExternalStore`, so the first client render matches the server's.
const getServerIsApple = () => true;

/** Writes a shortcut as the viewer's keyboard prints it: ⌘ on a Mac, Ctrl anywhere else. */
export const useShortcutLabel = () => {
  const isApple = useSyncExternalStore(subscribe, getIsApple, getServerIsApple);

  return useCallback((name: ShortcutName) => getShortcutLabel(name, isApple), [isApple]);
};
