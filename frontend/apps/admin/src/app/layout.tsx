import { DevtoolsProvider } from '@/providers/devtools';
import { AuthDatabaseCollection } from '@packages/common';
import { Refine } from '@refinedev/core';
import { RefineKbar, RefineKbarProvider } from '@refinedev/kbar';
import { RefineSnackbarProvider, useNotificationProvider } from '@refinedev/mui';
import routerProvider from '@refinedev/nextjs-router';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import React, { Suspense } from 'react';

import { ColorModeContextProvider } from '@/contexts/color-mode';
import { authProvider } from '@/providers/auth-provider';
import { httpDataProvider, grpcDataProvider } from '@/providers/data-provider';

export const metadata: Metadata = {
  title: 'Base admin panel',
  description: 'Base admin panel',
  icons: {
    icon: '/favicon.ico',
  },
};

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
                    }}
                    notificationProvider={useNotificationProvider}
                    authProvider={authProvider}
                    resources={[
                      {
                        name: AuthDatabaseCollection.USER,
                        list: `/${AuthDatabaseCollection.USER}`,
                        create: `/${AuthDatabaseCollection.USER}/create`,
                        edit: `/${AuthDatabaseCollection.USER}/edit/:id`,
                        show: `/${AuthDatabaseCollection.USER}/show/:id`,
                        meta: {
                          canDelete: true,
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
