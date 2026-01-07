import { config } from '@/config';
import { headers as getHeaders } from 'next/headers.js';
import { redirect } from 'next/navigation';
import { getPayload } from 'payload';

import payloadConfig from '@/payload.config';
import './styles.css';

export default async function HomePage() {
  const headers = await getHeaders();
  const pConfig = await payloadConfig;
  const payload = await getPayload({ config: pConfig });
  const { user } = await payload.auth({ headers });

  redirect(user?.email ? '/admin' : config.auth.url);
}
