'use server';

import {
  clearCookies,
  checkAccessToken,
  refreshAuthData,
  setAuthCookies,
} from '@/helpers/auth.helpers';
import { GrpcAuthLogin, GrpcUser } from '@frontend/grpc';
import { type AuthActionResponse, CheckResponse } from '@refinedev/core';
import { authGrpcRepository } from '@/repositories';
import _ from 'lodash';

export async function checkAccess(): Promise<CheckResponse> {
  try {
    const accessToken = await checkAccessToken();

    if (!accessToken) {
      await refreshAuthData();
    }

    return { authenticated: true };
  } catch (error) {
    await clearCookies();

    return {
      authenticated: false,
      logout: true,
      redirectTo: '/login',
    };
  }
}

export async function login(request: GrpcAuthLogin): Promise<AuthActionResponse> {
  try {
    const authData = await authGrpcRepository.login(request);
    await setAuthCookies(authData);
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
  await clearCookies();

  return {
    success: true,
    redirectTo: '/login',
  };
}

export async function me(): Promise<GrpcUser | null> {
  try {
    let accessToken = await checkAccessToken();

    if (!accessToken) {
      accessToken = await refreshAuthData();
    }

    return authGrpcRepository.me({ accessToken });
  } catch (error) {
    await clearCookies();
    return null;
  }
}
