'use client';

import { Box, Stack } from '@mui/material';
import Button from '@mui/material/Button';
import { ButtonOwnProps } from '@mui/material/Button/Button';
import { Database } from '@packages/common';
import { ExternalIcon } from 'next/dist/client/components/react-dev-overlay/ui/icons/external';
import { FC } from 'react';

type ButtonProps = Omit<ButtonOwnProps, 'href'> & {
  database: Database;
  resource: string;
  id?: string;
};

export const RefButton: FC<ButtonProps> = ({
  database,
  resource,
  id,
  children,
  ...props
}: ButtonProps) => {
  return (
    <Box sx={{ width: 1, display: 'flex', gap: 2 }}>
      <Button
        href={id ? `/${database}/${resource}/show/${id}` : undefined}
        variant="outlined"
        startIcon={<ExternalIcon />}
        {...props}
      >
        {children}
      </Button>
    </Box>
  );
};

export type RefButtonContainerProps = {
  refs: (Omit<ButtonProps, 'children'> & { label: string })[];
};

export const RefButtonContainer: FC<RefButtonContainerProps> = ({
  refs,
}: RefButtonContainerProps) => {
  return (
    <Stack direction="row" gap={2}>
      {refs.map((ref) => (
        <RefButton
          key={`${ref.database}-${ref.resource}-${ref.id}`}
          resource={ref.resource}
          database={ref.database}
          id={ref.id}
          fullWidth
        >
          {ref.label}
        </RefButton>
      ))}
    </Stack>
  );
};
