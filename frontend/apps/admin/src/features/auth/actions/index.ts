'use server';

import { authService } from '@/features/auth/services';
import { GrpcAuthLogin, GrpcUser } from '@frontend/grpc';
import { type AuthActionResponse, CheckResponse } from '@refinedev/core';
import _ from 'lodash';

export async function checkAccess(): Promise<CheckResponse> {
  try {
    const hasAuth = await authService.hasAuth();

    if (!hasAuth) {
      await authService.refreshAuthData();
    }

    return { authenticated: true };
  } catch (error) {
    await authService.clearCookies();

    return {
      authenticated: false,
      logout: true,
      redirectTo: '/login',
    };
  }
}

export async function login(request: GrpcAuthLogin): Promise<AuthActionResponse> {
  try {
    await authService.login(request);
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
  await authService.clearCookies();

  return {
    success: true,
    redirectTo: '/login',
  };
}

export async function me(): Promise<GrpcUser | null> {
  try {
    return authService.getCurrentUser();
  } catch (error) {
    await authService.clearCookies();
    return null;
  }
}
