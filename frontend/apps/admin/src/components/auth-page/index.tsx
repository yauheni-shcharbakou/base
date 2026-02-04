'use server';

import { authPageRenderContent } from '@/components/auth-page/client';
import { config } from '@/config';
import type { AuthPageProps } from '@refinedev/core';
import { AuthPage as AuthPageBase } from '@refinedev/mui';

export const AuthPage = async (props: AuthPageProps) => {
  return (
    <AuthPageBase
      {...props}
      formProps={{ defaultValues: config.defaultAuth }}
      renderContent={authPageRenderContent}
    />
  );
};
