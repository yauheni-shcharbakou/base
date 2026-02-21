import { UnauthorizedLayout } from '@/features/auth/components';

export default async function LoginPage() {
  return <UnauthorizedLayout type="login" />;
}
