import { AuthLogin } from '@packages/grpc.js';
import { authGrpcRepository } from '@/repositories';
import _ from 'lodash';
import moment from 'moment';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const body: AuthLogin = await req.json();
    const data = await authGrpcRepository.login(body);

    cookieStore.set('role', data.user!.role, {
      httpOnly: true,
      expires: moment().add(1, 'hour').toDate(),
    });

    cookieStore.set('access-token', data.tokens!.accessToken, {
      httpOnly: true,
      expires: moment().add(1, 'hour').toDate(),
    });

    cookieStore.set('refresh-token', data.tokens!.refreshToken, {
      httpOnly: true,
      expires: moment().add(24, 'hour').toDate(),
    });

    return NextResponse.json({});
  } catch (error) {
    let errorMessage = 'Unauthorized';

    if (error instanceof Error) {
      if ('details' in error && _.isString(error.details)) {
        errorMessage = error.details;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json({ message: errorMessage }, { status: 401 });
  }
}
