import { checkAccess } from '@/actions/auth.actions';
import { Header } from '@/components/header';
import { ThemedLayout } from '@refinedev/mui';
import { redirect } from 'next/navigation';
import React from 'react';

export default async function Layout({ children }: React.PropsWithChildren) {
  const { authenticated, redirectTo } = await checkAccess();

  if (!authenticated) {
    return redirect(redirectTo || '/login');
  }

  return <ThemedLayout Header={Header}>{children}</ThemedLayout>;
}
