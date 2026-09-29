'use client';

import { Card, Skeleton } from '@mui/material';
import React, { FC } from 'react';
import { BunnyPlayer } from './bunny-player';

type Props = {
  videoId?: string;
};

/** A show page's player: no autoplay, and the player's own keys. */
export const VideoPlayer: FC<Props> = ({ videoId }) => {
  if (!videoId) {
    return <Skeleton variant="rectangular" height={400} animation="wave" />;
  }

  return (
    <Card variant="elevation" elevation={1} style={{ position: 'relative', paddingTop: '56.25%' }}>
      <BunnyPlayer videoId={videoId} title="Video player" sx={{ position: 'absolute', inset: 0 }} />
    </Card>
  );
};
