'use client';

import { checkAccess, login, logout, me } from '@/features/auth/actions';
import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import type { AuthActionResponse, AuthProvider, OnErrorResponse } from '@refinedev/core';

type LoginParams = {
  email: string;
  password: string;
  remember?: boolean;
};

// The statuses of a session that is over: no valid token (401), or not an admin (403).
const isSignedOut = (statusCode?: number) => statusCode === 401 || statusCode === 403;

export const authProvider: AuthProvider = {
  check: async () => checkAccess(),
  getIdentity: async () => {
    const result = await me();

    if (!result.ok && isSignedOut(result.error.statusCode)) {
      return null;
    }

    return unwrapActionResult(result);
  },
  login: async (params: LoginParams): Promise<AuthActionResponse> => {
    return login({ login: params.email, password: params.password });
  },
  logout: async () => logout(),
  // A failed action reaches Refine through `unwrapActionResult`, which puts its status in `statusCode`.
  onError: async (error: any): Promise<OnErrorResponse> => {
    if (isSignedOut(error?.statusCode)) {
      return { logout: true };
    }

    return { error };
  },
};
