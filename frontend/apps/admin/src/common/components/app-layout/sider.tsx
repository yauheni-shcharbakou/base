'use client';

import { ApiOutlined } from '@mui/icons-material';
import { Typography } from '@mui/material';
import { TitleProps } from '@refinedev/core';
import { RefineThemedLayoutSiderProps, ThemedSider } from '@refinedev/mui';
import React, { FC } from 'react';

const AppTitle: FC<TitleProps> = (props) => {
  if (props.collapsed) {
    return <ApiOutlined color="primary" />;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <ApiOutlined color="primary" />
      <Typography variant="body1" marginLeft={1}>
        Base admin panel
      </Typography>
    </div>
  );
};

export const Sider: FC<RefineThemedLayoutSiderProps> = (props) => {
  return (
    <ThemedSider
      {...props}
      Title={AppTitle}
      render={({ logout, items }) => (
        <>
          {items}
          {logout}
        </>
      )}
    />
  );
};
