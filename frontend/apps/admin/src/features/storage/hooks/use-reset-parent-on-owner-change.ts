import { useEffect, useRef } from 'react';

/**
 * A form that places an object keeps its folder only while the owner stands: another owner's
 * folders are not theirs, so the folder is cleared once the owner changes.
 */
export const useResetParentOnOwnerChange = (
  userId: string | undefined,
  setParent: (id: string) => void,
) => {
  const previousUserId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!userId || userId === previousUserId.current) {
      return;
    }

    previousUserId.current = userId;
    setParent('');
  }, [userId, setParent]);
};
