'use server';

import { authPageRenderContent } from '@/components/auth-page/client';
import { configService } from '@/services';
import type { AuthPageProps } from '@refinedev/core';
import { AuthPage as AuthPageBase } from '@refinedev/mui';

export const AuthPage = async (props: AuthPageProps) => {
  return (
    <AuthPageBase
      {...props}
      formProps={{ defaultValues: configService.getDefaultAuth() }}
      renderContent={authPageRenderContent}
    />
  );
};
