import { DevtoolsProvider } from '@/common/components';
import { authProvider } from '@/features/auth/providers';
import { grpcDataProvider, grpcUploadDataProvider } from '@/features/grpc/providers';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { Refine } from '@refinedev/core';
import { RefineKbar, RefineKbarProvider } from '@refinedev/kbar';
import { RefineSnackbarProvider, useNotificationProvider } from '@refinedev/mui';
import routerProvider from '@refinedev/nextjs-router';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import React, { ReactNode, Suspense } from 'react';

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
                    resources={[
                      {
                        name: Database.AUTH,
                        meta: {
                          label: Database.AUTH,
                        },
                      },
                      {
                        name: Database.STORAGE,
                        meta: {
                          label: Database.STORAGE,
                        },
                      },

                      {
                        name: AuthDatabaseEntity.USER,
                        list: `/${Database.AUTH}/${AuthDatabaseEntity.USER}`,
                        create: `/${Database.AUTH}/${AuthDatabaseEntity.USER}/create`,
                        edit: `/${Database.AUTH}/${AuthDatabaseEntity.USER}/edit/:id`,
                        show: `/${Database.AUTH}/${AuthDatabaseEntity.USER}/show/:id`,
                        meta: {
                          canDelete: true,
                          parent: Database.AUTH,
                        },
                      },
                      {
                        name: AuthDatabaseEntity.TEMP_CODE,
                        list: `/${Database.AUTH}/${AuthDatabaseEntity.TEMP_CODE}`,
                        show: `/${Database.AUTH}/${AuthDatabaseEntity.TEMP_CODE}/show/:id`,
                        meta: {
                          canDelete: true,
                          parent: Database.AUTH,
                        },
                      },

                      {
                        name: StorageDatabaseEntity.FILE,
                        list: `/${Database.STORAGE}/${StorageDatabaseEntity.FILE}`,
                        create: `/${Database.STORAGE}/${StorageDatabaseEntity.FILE}/create`,
                        show: `/${Database.STORAGE}/${StorageDatabaseEntity.FILE}/show/:id`,
                        meta: {
                          canDelete: true,
                          dataProviderName: 'upload',
                          parent: Database.STORAGE,
                        },
                      },
                      {
                        name: StorageDatabaseEntity.IMAGE,
                        list: `/${Database.STORAGE}/${StorageDatabaseEntity.IMAGE}`,
                        create: `/${Database.STORAGE}/${StorageDatabaseEntity.IMAGE}/create`,
                        edit: `/${Database.STORAGE}/${StorageDatabaseEntity.IMAGE}/edit/:id`,
                        show: `/${Database.STORAGE}/${StorageDatabaseEntity.IMAGE}/show/:id`,
                        meta: {
                          canDelete: true,
                          dataProviderName: 'upload',
                          parent: Database.STORAGE,
                        },
                      },
                      {
                        name: StorageDatabaseEntity.STORAGE_OBJECT,
                        list: `/${Database.STORAGE}/${StorageDatabaseEntity.STORAGE_OBJECT}`,
                        create: `/${Database.STORAGE}/${StorageDatabaseEntity.STORAGE_OBJECT}/create`,
                        edit: `/${Database.STORAGE}/${StorageDatabaseEntity.STORAGE_OBJECT}/edit/:id`,
                        show: `/${Database.STORAGE}/${StorageDatabaseEntity.STORAGE_OBJECT}/show/:id`,
                        meta: {
                          canDelete: true,
                          parent: Database.STORAGE,
                        },
                      },
                      {
                        name: StorageDatabaseEntity.VIDEO,
                        list: `/${Database.STORAGE}/${StorageDatabaseEntity.VIDEO}`,
                        create: `/${Database.STORAGE}/${StorageDatabaseEntity.VIDEO}/create`,
                        edit: `/${Database.STORAGE}/${StorageDatabaseEntity.VIDEO}/edit/:id`,
                        show: `/${Database.STORAGE}/${StorageDatabaseEntity.VIDEO}/show/:id`,
                        meta: {
                          canDelete: true,
                          dataProviderName: 'upload',
                          parent: Database.STORAGE,
                        },
                      },
                    ]}
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
