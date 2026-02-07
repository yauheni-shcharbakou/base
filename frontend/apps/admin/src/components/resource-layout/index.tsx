'use server';

import { Header } from '@/components/header';
import { Sider } from '@/components/sider';
import { authService } from '@/services';
import { ThemedLayout } from '@refinedev/mui';
import { redirect } from 'next/navigation';
import React, { PropsWithChildren } from 'react';

export const ResourceLayout = async ({ children }: PropsWithChildren) => {
  const hasAuth = await authService.hasAuth();

  if (!hasAuth) {
    redirect('/login');
  }

  return (
    <ThemedLayout Header={Header} Sider={Sider}>
      {children}
    </ThemedLayout>
  );
};
