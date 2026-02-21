import { UnauthorizedLayout } from '@/features/auth/components';

export default async function RegisterPage() {
  return <UnauthorizedLayout type="register" />;
}
