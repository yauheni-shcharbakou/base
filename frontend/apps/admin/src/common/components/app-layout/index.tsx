'use client';

import { Header } from '@/common/components/app-layout/header';
import { Sider } from '@/common/components/app-layout/sider';
import { ThemedLayout } from '@refinedev/mui';
import React, { FC, PropsWithChildren } from 'react';

export const AppLayout: FC<PropsWithChildren> = ({ children }: PropsWithChildren) => {
  return (
    <ThemedLayout Header={Header} Sider={Sider}>
      {children}
    </ThemedLayout>
  );
};
