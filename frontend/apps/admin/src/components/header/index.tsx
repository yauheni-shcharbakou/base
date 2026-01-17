'use client';

import { ColorModeContext } from '@/contexts/color-mode';
import { DarkModeOutlined, LightModeOutlined } from '@mui/icons-material';
import { Stack, Typography, Toolbar, AppBar, Avatar, IconButton } from '@mui/material';
import type { User } from '@packages/grpc.js';
import { useGetIdentity } from '@refinedev/core';
import { HamburgerMenu, RefineThemedLayoutHeaderProps } from '@refinedev/mui';
import React, { useContext } from 'react';

export const Header: React.FC<RefineThemedLayoutHeaderProps> = ({ sticky = true }) => {
  const { mode, setMode } = useContext(ColorModeContext);
  const { data: user } = useGetIdentity<User>();

  return (
    <AppBar position={sticky ? 'sticky' : 'relative'}>
      <Toolbar>
        <Stack direction="row" width="100%" justifyContent="flex-end" alignItems="center">
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
