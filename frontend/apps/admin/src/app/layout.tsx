import { DevtoolsProvider } from '@/common/components';
import { pathProvider } from '@/common/providers';
import { authProvider } from '@/features/auth/providers';
import { grpcDataProvider, grpcUploadDataProvider } from '@/features/grpc/providers';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { Refine, ResourceProps } from '@refinedev/core';
import { RefineKbar, RefineKbarProvider } from '@refinedev/kbar';
import { RefineSnackbarProvider, useNotificationProvider } from '@refinedev/mui';
import routerProvider from '@refinedev/nextjs-router';
import { pascalCase } from 'change-case-all';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import React, { ReactNode, Suspense } from 'react';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';

import { ColorModeContextProvider } from '@/common/contexts';

export const metadata: Metadata = {
  title: 'Base admin panel',
  description: 'Base admin panel',
  icons: {
    icon: '/favicon.ico',
  },
};

// TODO: create custom list view
// TODO: try migrate to 16 Next

const resources: ResourceProps[] = [
  {
    name: Database.AUTH,
    meta: {
      label: pascalCase(Database.AUTH),
      icon: <PersonOutlineOutlinedIcon />,
    },
  },
  {
    name: Database.STORAGE,
    meta: {
      label: pascalCase(Database.STORAGE),
      icon: <FolderOutlinedIcon />,
    },
  },

  {
    ...pathProvider.getResourcePages(Database.AUTH, AuthDatabaseEntity.USER),
    name: AuthDatabaseEntity.USER,
    meta: {
      canDelete: true,
      parent: Database.AUTH,
      icon: <PersonOutlineOutlinedIcon color="primary" />,
    },
  },
  {
    ...pathProvider.getResourcePages(Database.AUTH, AuthDatabaseEntity.TEMP_CODE, ['list', 'show']),
    name: AuthDatabaseEntity.TEMP_CODE,
    meta: {
      canDelete: true,
      parent: Database.AUTH,
      icon: <KeyOutlinedIcon color="primary" />,
    },
  },

  {
    ...pathProvider.getResourcePages(Database.STORAGE, StorageDatabaseEntity.FILE, [
      'list',
      'show',
      'create',
    ]),
    name: StorageDatabaseEntity.FILE,
    meta: {
      canDelete: true,
      dataProviderName: 'upload',
      parent: Database.STORAGE,
      icon: <InsertDriveFileOutlinedIcon color="primary" />,
    },
  },
  {
    ...pathProvider.getResourcePages(Database.STORAGE, StorageDatabaseEntity.IMAGE),
    name: StorageDatabaseEntity.IMAGE,
    meta: {
      canDelete: true,
      dataProviderName: 'upload',
      parent: Database.STORAGE,
      icon: <ImageOutlinedIcon color="primary" />,
    },
  },
  {
    ...pathProvider.getResourcePages(Database.STORAGE, StorageDatabaseEntity.STORAGE_OBJECT),
    name: StorageDatabaseEntity.STORAGE_OBJECT,
    meta: {
      canDelete: true,
      parent: Database.STORAGE,
      icon: <FolderOutlinedIcon color="primary" />,
    },
  },
  {
    ...pathProvider.getResourcePages(Database.STORAGE, StorageDatabaseEntity.VIDEO),
    name: StorageDatabaseEntity.VIDEO,
    meta: {
      canDelete: true,
      dataProviderName: 'upload',
      parent: Database.STORAGE,
      icon: <PlayCircleOutlineOutlinedIcon color="primary" />,
    },
  },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme');
  const defaultMode = theme?.value === 'light' ? 'light' : 'dark';

  return (
    <html lang="en">
      <body>
        <Suspense>
          <RefineKbarProvider>
            <ColorModeContextProvider defaultMode={defaultMode}>
              <RefineSnackbarProvider>
                <DevtoolsProvider>
                  <Refine
                    routerProvider={routerProvider}
                    dataProvider={{
                      default: grpcDataProvider,
                      upload: grpcUploadDataProvider,
                    }}
                    notificationProvider={useNotificationProvider}
                    authProvider={authProvider}
                    resources={resources}
                    options={{
                      syncWithLocation: true,
                      warnWhenUnsavedChanges: true,
                      disableTelemetry: true,
                    }}
                  >
                    {children}
                    <RefineKbar />
                  </Refine>
                </DevtoolsProvider>
              </RefineSnackbarProvider>
            </ColorModeContextProvider>
          </RefineKbarProvider>
        </Suspense>
      </body>
    </html>
  );
}
