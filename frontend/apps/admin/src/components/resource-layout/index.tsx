'use server';

import { checkAccess } from '@/actions/auth.actions';
import { Header } from '@/components/header';
import { Sider } from '@/components/sider';
import { ThemedLayout, ThemedSider } from '@refinedev/mui';
import { redirect } from 'next/navigation';
import React, { PropsWithChildren } from 'react';

export const ResourceLayout = async ({ children }: PropsWithChildren) => {
  const { authenticated, redirectTo } = await checkAccess();

  if (!authenticated) {
    return redirect(redirectTo || '/login');
  }

  return (
    <ThemedLayout Header={Header} Sider={Sider}>
      {children}
    </ThemedLayout>
  );
};
