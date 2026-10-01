'use client';

import { Button, ButtonProps } from '@mui/material';
import NextLink from 'next/link';
import React, { FC } from 'react';

type Props = Omit<ButtonProps, 'title' | 'sx' | 'startIcon' | 'endIcon'> & {
  // The button shows only its icon: this is its hover hint and its accessible name.
  title: string;
};

/**
 * An icon-only action of a list row, shaped like Refine's `hideText` edit, show and delete buttons
 * beside it — a text `Button` without a minimum width — so a row's own actions do not stand out.
 * An `href` navigates on the client.
 */
export const RowActionButton: FC<Props> = ({ title, children, ...props }) => (
  <Button title={title} aria-label={title} LinkComponent={NextLink} sx={{ minWidth: 0 }} {...props}>
    {children}
  </Button>
);
