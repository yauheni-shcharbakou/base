'use client';

import { getErrorMessage } from '@/common/helpers/error.helpers';
import { Button } from '@mui/material';
import { DownloadOutlined } from '@mui/icons-material';
import { ButtonOwnProps } from '@mui/material/Button/Button';
import { useNotification } from '@refinedev/core';
import { FC, useState } from 'react';

type Props = Omit<ButtonOwnProps, 'onClick' | 'disabled' | 'startIcon'> & {
  resource: string;
  id: string;
};

export const DownloadButton: FC<Props> = ({ resource, id, ...buttonProps }: Props) => {
  const [loading, setLoading] = useState(false);
  const { open } = useNotification();

  const handleDownload = async () => {
    setLoading(() => true);

    try {
      const link = document.createElement('a');
      link.href = `/api/${resource}/${id}/download`;
      link.setAttribute('download', '');
      document.body.appendChild(link);
      link.click();
      link.remove();
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
      onClick={handleDownload}
      disabled={loading}
      startIcon={<DownloadOutlined />}
      {...buttonProps}
    >
      {loading ? 'Loading...' : 'Download'}
    </Button>
  );
};
