'use server';

import { Header } from '@/components/header';
import { Sider } from '@/components/sider';
import { checkAccessToken } from '@/helpers/auth.helpers';
import { ThemedLayout } from '@refinedev/mui';
import { redirect } from 'next/navigation';
import React, { PropsWithChildren } from 'react';

export const ResourceLayout = async ({ children }: PropsWithChildren) => {
  const accessToken = await checkAccessToken();

  if (!accessToken) {
    redirect('/login');
  }

  return (
    <ThemedLayout Header={Header} Sider={Sider}>
      {children}
    </ThemedLayout>
  );
};
