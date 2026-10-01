'use client';

import {
  ControlledSingleSelect,
  ControlledSingleSelectProps,
  SelectOption,
} from '@/common/components';
import {
  LeafType,
  MEDIA_BY_TYPE,
  MediaRecord,
  mediaOption,
  placeableMediaFilters,
} from '@/features/storage/helpers';
import { useList } from '@refinedev/core';
import { useEffect, useRef, useState } from 'react';
import { FieldValues } from 'react-hook-form';

type Props<V extends FieldValues = FieldValues, E = any, T = V> = Omit<
  ControlledSingleSelectProps<V, E, T>,
  'defaultValue' | 'options'
> & {
  type: LeafType;
  userId?: string;
  onOptionsLoaded?: (options: SelectOption[]) => void;
};

/**
 * The owner's media a new leaf may place: nothing places it yet and its upload is READY — exactly
 * what the backend accepts, so a pick is refused only if the media changed in between.
 */
export const MediaSelect = <V extends FieldValues = FieldValues, E = any, T = V>({
  type,
  userId,
  onOptionsLoaded,
  ...props
}: Props<V, E, T>) => {
  const [options, setOptions] = useState<SelectOption[]>([]);

  // Keep the latest callback in a ref so the effect doesn't depend on it.
  const onOptionsLoadedRef = useRef(onOptionsLoaded);

  useEffect(() => {
    onOptionsLoadedRef.current = onOptionsLoaded;
  });

  const { result } = useList<MediaRecord>({
    resource: MEDIA_BY_TYPE[type].resource,
    filters: userId ? placeableMediaFilters(type, userId) : [],
    pagination: { pageSize: 100, currentPage: 1 },
    queryOptions: { enabled: !!userId },
  });

  useEffect(() => {
    const next = userId ? (result.data ?? []).map((record) => mediaOption(type, record)) : [];

    setOptions(next);
    onOptionsLoadedRef.current?.(next);
  }, [result.data, type, userId]);

  return <ControlledSingleSelect {...props} options={options} />;
};
