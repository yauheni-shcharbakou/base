import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * A create or upload form opened from a folder (`?userId=&parent=`, the folder browser's "New"):
 * the owner and the folder filled in. The folder stands for its own owner only, and only until the
 * owner changes — another owner's folders are not theirs, so the folder is cleared then.
 */
export const usePresetPlacement = (userId: string | undefined, setParent: (id: string) => void) => {
  const searchParams = useSearchParams();
  const presetUserId = searchParams.get('userId') || undefined;
  const presetParent = searchParams.get('parent') || undefined;
  const previousUserId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!userId || userId === previousUserId.current) {
      return;
    }

    const isPreset = !previousUserId.current && userId === presetUserId;
    previousUserId.current = userId;
    setParent(isPreset ? (presetParent ?? '') : '');
  }, [userId, presetUserId, presetParent, setParent]);

  return { presetUserId };
};
