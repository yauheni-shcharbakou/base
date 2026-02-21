'use client';

import { getErrorMessage } from '@/common/helpers/error.helpers';
import { Button } from '@mui/material';
import { DownloadOutlined } from '@mui/icons-material';
import { ButtonOwnProps } from '@mui/material/Button/Button';
import { useNotification } from '@refinedev/core';
import { FC, useState } from 'react';

type Props = Omit<ButtonOwnProps, 'onClick' | 'disabled' | 'startIcon'> & {
  url: string;
  fileName: string;
};

export const DownloadButton: FC<Props> = ({
  url: downloadUrl,
  fileName,
  ...buttonProps
}: Props) => {
  const [loading, setLoading] = useState(false);
  const { open } = useNotification();

  const handleDownload = async () => {
    setLoading(() => true);

    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      open?.({
        type: 'error',
        message: 'Download error',
        description: getErrorMessage(error),
        key: `download-error-${Date.now()}`,
      });
    } finally {
      setLoading(() => false);
    }
  };

  return (
    <Button
      {...buttonProps}
      onClick={handleDownload}
      disabled={loading}
      startIcon={<DownloadOutlined />}
    >
      {loading ? 'Loading...' : 'Download'}
    </Button>
  );
};
