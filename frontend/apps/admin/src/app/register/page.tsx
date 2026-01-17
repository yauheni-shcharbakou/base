import { checkAccess } from '@/actions/auth.actions';
import { AuthPage } from '@/components/auth-page';
import { redirect } from 'next/navigation';

export default async function Register() {
  const { authenticated, redirectTo } = await checkAccess();

  if (authenticated) {
    redirect(redirectTo || '/');
  }

  return <AuthPage type="register" />;
}
