'use client';

import { ColorModeContext } from '@/common/contexts/color-mode';
import { DarkModeOutlined, LightModeOutlined } from '@mui/icons-material';
import { Stack, Typography, Toolbar, AppBar, IconButton } from '@mui/material';
import { GrpcUser } from '@frontend/grpc';
import { useGetIdentity } from '@refinedev/core';
import { HamburgerMenu, RefineThemedLayoutHeaderProps } from '@refinedev/mui';
import React, { FC, useContext } from 'react';

export const Header: FC<RefineThemedLayoutHeaderProps> = ({ sticky = true }) => {
  const { mode, setMode } = useContext(ColorModeContext);
  const { data: user } = useGetIdentity<GrpcUser>();

  return (
    <AppBar position={sticky ? 'sticky' : 'relative'} elevation={0}>
      <Toolbar>
        <Stack
          direction="row"
          width="100%"
          justifyContent="flex-end"
          alignItems="center"
          bgcolor="transparent"
        >
          <HamburgerMenu />
          <Stack direction="row" width="100%" justifyContent="flex-end" alignItems="center">
            <IconButton color="inherit" onClick={setMode}>
              {mode === 'dark' ? <LightModeOutlined /> : <DarkModeOutlined />}
            </IconButton>

            {user?.email && (
              <Stack direction="row" gap="16px" alignItems="center" justifyContent="center">
                {user?.email && (
                  <Typography
                    sx={{
                      display: {
                        xs: 'none',
                        sm: 'inline-block',
                      },
                    }}
                    variant="subtitle2"
                  >
                    {user?.email}
                  </Typography>
                )}
                {/*<Avatar src={user?.avatar} alt={user?.name} />*/}
              </Stack>
            )}
          </Stack>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};
