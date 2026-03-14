import { DevtoolsProvider } from '@/common/components';
import { authProvider } from '@/features/auth/providers';
import { grpcDataProvider, grpcUploadDataProvider } from '@/features/grpc/providers';
import { httpDataProvider } from '@/features/http/providers';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { Refine } from '@refinedev/core';
import { RefineKbar, RefineKbarProvider } from '@refinedev/kbar';
import { RefineSnackbarProvider, useNotificationProvider } from '@refinedev/mui';
import routerProvider from '@refinedev/nextjs-router';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import React, { Suspense } from 'react';

import { ColorModeContextProvider } from '@/common/contexts';

export const metadata: Metadata = {
  title: 'Base admin panel',
  description: 'Base admin panel',
  icons: {
    icon: '/favicon.ico',
  },
};

// TODO: create custom list view
// TODO: implement custom hook for useForm (zod validation)
// TODO: uploadMany logic for files / images / videos
// TODO: try migrate to 16 Next

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
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
                      http: httpDataProvider,
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

                      {
                        name: 'blog_posts',
                        list: '/blog-posts',
                        create: '/blog-posts/create',
                        edit: '/blog-posts/edit/:id',
                        show: '/blog-posts/show/:id',
                        meta: {
                          canDelete: true,
                          dataProviderName: 'http',
                        },
                      },
                      {
                        name: 'categories',
                        list: '/categories',
                        create: '/categories/create',
                        edit: '/categories/edit/:id',
                        show: '/categories/show/:id',
                        meta: {
                          canDelete: true,
                          dataProviderName: 'http',
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
