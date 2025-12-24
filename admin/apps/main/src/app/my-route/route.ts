import { AuthService } from '@/services/auth.service';
import configPromise from '@payload-config';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';

export const POST = async (request: Request) => {
  const payload = await getPayload({
    config: configPromise,
  });

  const body = await request.json();

  console.log(body);

  // console.log(JSON.parse(body));
  // @ts-ignore
  AuthService.setEmail(body?.['email']);
  payload.emailField = body?.['email'];

  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Set-Cookie': `access-token=12345; HttpOnly; Path=/; SameSite=Lax`,
      },
    },
  );
};
