'use server';

import { config } from '@/config';
import { AuthData, AuthLogin, AuthToken, User, UserRole } from '@frontend/grpc';
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

const getAccessToken = (authData: AuthData): AuthToken => {
  return _.get(authData, 'tokens.accessToken')!;
};

const getRefreshToken = (authData: AuthData): AuthToken => {
  return _.get(authData, 'tokens.refreshToken')!;
};

export async function checkAccess(): Promise<CheckResponse> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access-token');
    const refreshToken = cookieStore.get('refresh-token');
    const role = cookieStore.get('role');

    if (!refreshToken?.value || role?.value !== UserRole.ADMIN) {
      throw new Error('Forbidden');
    }

    if (!accessToken?.value && refreshToken?.value) {
      // TODO: add role to refreshToken response
      const authData = await authGrpcRepository.refreshToken({ refreshToken: refreshToken.value });

      const accessTokenData = getAccessToken(authData);
      const refreshTokenData = getRefreshToken(authData);

      cookieStore.set('access-token', accessTokenData.value, {
        ...cookieConfig,
        expires: accessTokenData.expireDate,
      });

      cookieStore.set('refresh-token', refreshTokenData.value, {
        ...cookieConfig,
        expires: refreshTokenData.expireDate,
      });
    }

    return {
      authenticated: true,
    };
  } catch (e) {
    return {
      authenticated: false,
      logout: true,
      redirectTo: '/login',
    };
  }
}

export async function login(request: AuthLogin): Promise<AuthActionResponse> {
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

export async function me(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access-token');

    if (!accessToken?.value) {
      throw new Error('Forbidden');
    }

    return authGrpcRepository.me({ accessToken: accessToken.value });
  } catch (e) {
    return null;
  }
}
