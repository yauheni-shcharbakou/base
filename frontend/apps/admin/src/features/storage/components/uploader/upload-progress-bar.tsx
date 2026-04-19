import { Box, LinearProgress, Typography } from '@mui/material';
import React, { FC } from 'react';

type SingleProps = {
  isUploading: boolean;
  progress: number;
};

export const SingleUploadProgressBar: FC<SingleProps> = ({ isUploading, progress }) => {
  if (!isUploading) {
    return null;
  }

  return (
    <Box width={1}>
      <Typography variant="body2" color="info" align="center" sx={{ mb: 1, mt: 1 }}>
        {(progress || 0).toFixed(2)} %
      </Typography>
      <LinearProgress variant="determinate" value={progress} />
    </Box>
  );
};

type MultiProps = {
  isUploading: boolean;
  uploadedCount: number;
  itemsCount: number;
};

export const MultiUploadProgressBar: FC<MultiProps> = ({
  isUploading,
  uploadedCount,
  itemsCount,
}) => {
  if (!isUploading) {
    return null;
  }

  return (
    <Box width={1}>
      <Typography variant="body2" color="info" align="center" sx={{ mb: 1, mt: 1 }}>
        {uploadedCount} / {itemsCount}
      </Typography>
      <LinearProgress variant="determinate" value={(uploadedCount / itemsCount) * 100} />
    </Box>
  );
};
