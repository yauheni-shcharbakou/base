'use client';

import type { ShortcutName } from '@/features/storage/helpers';
import { useShortcutLabel } from '@/features/storage/hooks';
import { Typography } from '@mui/material';
import React, { FC } from 'react';

/** A menu entry's key, at its end — as a native menu shows it, written for the viewer's keyboard. */
export const MenuShortcut: FC<{ name: ShortcutName }> = ({ name }) => {
  const shortcut = useShortcutLabel();

  return (
    <Typography variant="body2" sx={{ ml: 3, color: 'text.secondary' }}>
      {shortcut(name)}
    </Typography>
  );
};
