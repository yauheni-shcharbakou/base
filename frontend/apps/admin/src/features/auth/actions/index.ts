'use server';

import { authService } from '@/features/auth/services';
import { runAction } from '@/features/grpc/helpers/run-action';
import type { ActionResult } from '@/features/grpc/types';
import type { ClientAuth } from '@frontend/proto';
import { type AuthActionResponse, CheckResponse } from '@refinedev/core';
import _ from 'lodash';

export async function checkAccess(): Promise<CheckResponse> {
  try {
    const hasAuth = await authService.hasAuthWithRefresh();

    if (!hasAuth) {
      throw new Error('Unauthorized');
    }

    return { authenticated: true };
  } catch (error) {
    // await authService.clearCookies();

    return {
      authenticated: false,
      logout: true,
      redirectTo: '/login',
    };
  }
}

export async function login(request: ClientAuth.AuthLogin): Promise<AuthActionResponse> {
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

// Signed out is a 401 (no refresh token, or a refused one) or a 403 (not an admin), which the auth
// provider's `getIdentity` reads as no identity.
export async function me(): Promise<ActionResult<ClientAuth.User>> {
  return runAction(() => authService.getCurrentUser());
}
