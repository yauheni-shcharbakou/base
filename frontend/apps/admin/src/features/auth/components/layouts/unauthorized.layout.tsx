'use server';

import { pathProvider } from '@/common/providers';
import { AuthPage } from '@/features/auth/components/pages/auth-page';
import { AuthDatabaseEntity, Database } from '@packages/common';
import { AuthPageProps } from '@refinedev/core';
import { redirect } from 'next/navigation';
import { checkAccess } from '../../actions';

type Props = Pick<AuthPageProps, 'type'>;

export const UnauthorizedLayout = async ({ type }: Props) => {
  const { authenticated } = await checkAccess();

  if (authenticated) {
    redirect(pathProvider.getListPath(Database.AUTH, AuthDatabaseEntity.USER));
  }

  return <AuthPage type={type} />;
};
