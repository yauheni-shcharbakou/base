'use server';

import { pathProvider } from '@/common/providers';
import { AuthPage } from '@/features/auth/components/pages/auth-page';
import { authService } from '@/features/auth/services';
import { AuthDatabaseEntity, Database } from '@packages/common';
import { AuthPageProps } from '@refinedev/core';
import { redirect } from 'next/navigation';
import React from 'react';

type Props = Pick<AuthPageProps, 'type'>;

export const UnauthorizedLayout = async ({ type }: Props) => {
  const hasAuth = await authService.hasAuth();

  if (hasAuth) {
    redirect(pathProvider.getListPath(Database.AUTH, AuthDatabaseEntity.USER));
  }

  return <AuthPage type={type} />;
};
