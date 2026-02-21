import { UnauthorizedLayout } from '@/features/auth/components';

export default async function ForgotPasswordPage() {
  return <UnauthorizedLayout type="forgotPassword" />;
}
