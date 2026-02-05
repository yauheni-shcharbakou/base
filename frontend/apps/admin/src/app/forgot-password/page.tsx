import { AuthPage } from '@/components/auth-page';
import { checkAccessToken } from '@/helpers/auth.helpers';
import { AuthDatabaseCollection } from '@packages/common';
import { redirect } from 'next/navigation';

export default async function ForgotPassword() {
  const accessToken = await checkAccessToken();

  if (accessToken) {
    redirect(`/${AuthDatabaseCollection.USER}`);
  }

  return <AuthPage type="forgotPassword" />;
}
