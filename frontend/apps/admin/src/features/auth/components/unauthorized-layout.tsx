'use server';

import { AuthPage } from '@/features/auth/components/auth-page';
import { authService } from '@/features/auth/services';
import { AuthDatabaseEntity } from '@packages/common';
import { AuthPageProps } from '@refinedev/core';
import { redirect } from 'next/navigation';
import React from 'react';

type Props = Pick<AuthPageProps, 'type'>;

export const UnauthorizedLayout = async ({ type }: Props) => {
  const hasAuth = await authService.hasAuth();

  if (hasAuth) {
    redirect(`/${AuthDatabaseEntity.USER}`);
  }

  return <AuthPage type={type} />;
};
