'use server';

import { AppLayout } from '@/common/components';
import { redirect } from 'next/navigation';
import { PropsWithChildren } from 'react';
import { checkAccess } from '../../actions';

export const AuthorizedLayout = async ({ children }: PropsWithChildren) => {
  const { authenticated } = await checkAccess();

  if (!authenticated) {
    redirect('/login');
  }

  return <AppLayout>{children}</AppLayout>;
};
