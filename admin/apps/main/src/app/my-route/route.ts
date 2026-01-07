import configPromise from '@payload-config';
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';

export const POST = async (request: Request) => {
  const payload = await getPayload({
    config: configPromise,
  });

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
