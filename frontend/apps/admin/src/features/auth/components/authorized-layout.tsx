'use server';

import { AppLayout } from '@/common/components';
import { authService } from '@/features/auth/services';
import { redirect } from 'next/navigation';
import React, { PropsWithChildren } from 'react';

export const AuthorizedLayout = async ({ children }: PropsWithChildren) => {
  const hasAuth = await authService.hasAuth();

  if (!hasAuth) {
    redirect('/login');
  }

  return <AppLayout>{children}</AppLayout>;
};
