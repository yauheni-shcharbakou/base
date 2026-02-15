import { AuthPage } from '@/components/auth-page';
import { authService } from '@/services';
import { AuthDatabaseCollection } from '@packages/common';
import { redirect } from 'next/navigation';

export default async function ForgotPasswordPage() {
  const hasAuth = await authService.hasAuth();

  if (hasAuth) {
    redirect(`/${AuthDatabaseCollection.USER}`);
  }

  return <AuthPage type="forgotPassword" />;
}
