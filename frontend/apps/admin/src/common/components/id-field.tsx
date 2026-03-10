'use client';

import { TypographyOwnProps } from '@mui/material/Typography/Typography';
import React, { FC, useState } from 'react';
import { Typography, Tooltip, Box, Zoom } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

type Props = TypographyOwnProps & {
  value?: string;
};

export const IdField: FC<Props> = ({ value, ...fieldProps }: Props) => {
  const [open, setOpen] = useState(false);

  const handleCopy = async () => {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setOpen(() => true);
    setTimeout(() => setOpen(() => false), 1_000);
  };

  return (
    <Box
      onClick={handleCopy}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: 'fit-content',
        maxWidth: '100%',
        cursor: 'pointer',
        transition: '0.2s',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          '& .copy-icon': { opacity: 1 },
        },
      }}
    >
      <Tooltip
        title="Copied"
        open={open}
        onClose={() => setOpen(false)}
        disableFocusListener
        disableHoverListener
        disableTouchListener
        slots={{
          transition: Zoom,
        }}
        placement="top"
      >
        <Typography
          variant="body1"
          component="span"
          color="warning"
          sx={{
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          {...fieldProps}
        >
          {value}
        </Typography>
      </Tooltip>

      <ContentCopyIcon
        className="copy-icon"
        sx={{
          fontSize: '1rem',
          opacity: 0,
          transition: '0.2s',
          color: 'text.secondary',
        }}
      />
    </Box>
  );
};
