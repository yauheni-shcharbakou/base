'use client';

import { Card, Skeleton } from '@mui/material';
import React, { FC } from 'react';

type Props = {
  videoId?: string;
};

export const VideoPlayer: FC<Props> = ({ videoId }: Props) => {
  if (!videoId) {
    return <Skeleton variant="rectangular" height={400} animation="wave" />;
  }

  return (
    <Card variant="elevation" elevation={1} style={{ position: 'relative', paddingTop: '56.25%' }}>
      <iframe
        src={`/api/videos/${videoId}/player`}
        loading="lazy"
        style={{
          border: '0',
          position: 'absolute',
          top: '0',
          height: '100%',
          width: '100%',
        }}
        allow="accelerometer;gyroscope;encrypted-media;picture-in-picture;"
        allowFullScreen
      ></iframe>
    </Card>
  );
};
