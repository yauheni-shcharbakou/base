'use server';

import { config } from '@/config';
import { GrpcAuthData, GrpcAuthLogin, GrpcAuthToken, GrpcUser, GrpcUserRole } from '@frontend/grpc';
import { type AuthActionResponse, CheckResponse } from '@refinedev/core';
import { authGrpcRepository } from '@/repositories';
import _ from 'lodash';
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies } from 'next/headers';

const cookieConfig: Partial<ResponseCookie> = {
  path: '/',
  httpOnly: true,
};

if (!config.isDevelopment) {
  cookieConfig.secure = true;
}

const getAccessToken = (authData: GrpcAuthData): GrpcAuthToken => {
  return _.get(authData, 'tokens.accessToken')!;
};

const getRefreshToken = (authData: GrpcAuthData): GrpcAuthToken => {
  return _.get(authData, 'tokens.refreshToken')!;
};

const cookiesAuth = async (): Promise<string> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access-token');
  const refreshToken = cookieStore.get('refresh-token');
  const role = cookieStore.get('role');

  if (accessToken?.value) {
    if (role?.value === GrpcUserRole.ADMIN) {
      return accessToken.value;
    }

    throw new Error('Forbidden');
  }

  if (!refreshToken?.value) {
    throw new Error('Forbidden');
  }

  const authData = await authGrpcRepository.refreshToken({ refreshToken: refreshToken.value });

  if (authData.user?.role !== GrpcUserRole.ADMIN) {
    throw new Error('Forbidden');
  }

  const accessTokenData = getAccessToken(authData);
  const refreshTokenData = getRefreshToken(authData);

  cookieStore.set('role', authData.user.role, {
    ...cookieConfig,
    expires: accessTokenData.expireDate,
  });

  cookieStore.set('access-token', accessTokenData.value, {
    ...cookieConfig,
    expires: accessTokenData.expireDate,
  });

  cookieStore.set('refresh-token', refreshTokenData.value, {
    ...cookieConfig,
    expires: refreshTokenData.expireDate,
  });

  return accessTokenData.value;
};

export async function checkAccess(): Promise<CheckResponse> {
  try {
    await cookiesAuth();
    return { authenticated: true };
  } catch (e) {
    return {
      authenticated: false,
      logout: true,
      redirectTo: '/login',
    };
  }
}

export async function login(request: GrpcAuthLogin): Promise<AuthActionResponse> {
  try {
    const cookieStore = await cookies();
    const authData = await authGrpcRepository.login(request);

    const accessTokenData = getAccessToken(authData);
    const refreshTokenData = getRefreshToken(authData);

    cookieStore.set('role', authData.user!.role, {
      ...cookieConfig,
      expires: accessTokenData.expireDate,
    });

    cookieStore.set('access-token', accessTokenData.value, {
      ...cookieConfig,
      expires: accessTokenData.expireDate,
    });

    cookieStore.set('refresh-token', refreshTokenData.value, {
      ...cookieConfig,
      expires: refreshTokenData.expireDate,
    });

    return { success: true };
  } catch (error) {
    let errorMessage = 'Unauthorized';

    if (error instanceof Error) {
      if ('details' in error && _.isString(error.details)) {
        errorMessage = error.details;
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: {
        name: 'LoginError',
        message: errorMessage,
      },
    };
  }
}

export async function logout(): Promise<AuthActionResponse> {
  const cookieStore = await cookies();

  cookieStore.delete({ name: 'access-token', path: '/' });
  cookieStore.delete({ name: 'refresh-token', path: '/' });
  cookieStore.delete({ name: 'role', path: '/' });

  return {
    success: true,
    redirectTo: '/login',
  };
}

export async function me(): Promise<GrpcUser | null> {
  try {
    const accessToken = await cookiesAuth();
    return authGrpcRepository.me({ accessToken });
  } catch (e) {
    return null;
  }
}
