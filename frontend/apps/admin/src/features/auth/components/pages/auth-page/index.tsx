'use server';

import { configService } from '@/common/services';
import { authPageRenderContent } from '@/features/auth/components/pages/auth-page/client-utils';
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
