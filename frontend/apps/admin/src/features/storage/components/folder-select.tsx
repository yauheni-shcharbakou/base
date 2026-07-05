'use client';

import {
  ControlledSingleSelect,
  ControlledSingleSelectProps,
  SelectOption,
} from '@/common/components';
import { folderActionProvider } from '@/features/storage/providers';
import { useEffect, useRef, useState } from 'react';
import { FieldValues } from 'react-hook-form';

type Props<V extends FieldValues = FieldValues, E = any, T = V> = Omit<
  ControlledSingleSelectProps<V, E, T>,
  'defaultValue' | 'options'
> & {
  defaultValue?: string;
  onOptionsLoaded?: (options?: SelectOption[]) => void;
  excludeChildrenOf?: string;
  userId?: string;
};

export const FolderSelect = <V extends FieldValues = FieldValues, E = any, T = V>({
  onOptionsLoaded,
  excludeChildrenOf,
  userId,
  ...props
}: Props<V, E, T>) => {
  const [options, setOptions] = useState<SelectOption[]>([]);

  // Keep the latest callback in a ref so the fetch effect can invoke it without
  // depending on it (it is usually an inline arrow that changes every render).
  const onOptionsLoadedRef = useRef(onOptionsLoaded);

  useEffect(() => {
    onOptionsLoadedRef.current = onOptionsLoaded;
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    folderActionProvider
      .getUserFolders(userId, excludeChildrenOf)
      .then((response) => {
        const next = response.map((folder) => ({ label: folder.folderPath!, value: folder.id }));

        setOptions(next);

        if (next.length) {
          onOptionsLoadedRef.current?.(next);
        }
      })
      .catch(console.error);
  }, [userId, excludeChildrenOf]);

  return <ControlledSingleSelect {...props} options={options} />;
};
