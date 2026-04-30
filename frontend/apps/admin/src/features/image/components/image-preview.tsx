'use client';

import { imageLoader } from '@/common/helpers';
import { Card, Skeleton } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import Image from 'next/image';
import React, { FC } from 'react';

type Props = {
  image?: BrowserStorage.Image;
};

export const ImagePreview: FC<Props> = ({ image }) => {
  if (!image) {
    return <Skeleton variant="rectangular" height={400} animation="wave" />;
  }

  return (
    <Card variant="elevation" elevation={1} sx={{ position: 'relative', height: '400px' }}>
      <Image
        alt={image.alt}
        src={`/api/files/${image.fileId}/open`}
        loading="lazy"
        style={{ objectFit: 'contain' }}
        loader={imageLoader}
        fill
      />
    </Card>
  );
};
