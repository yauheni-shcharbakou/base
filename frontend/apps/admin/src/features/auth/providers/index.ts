'use client';

import { checkAccess, login, me } from '@/features/auth/actions';
import { LOGOUT_PATH } from '@/features/auth/helpers/logout-path';
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
  // A form post, so the session ends with a new document: the queries of the page left behind and
  // their cache go with it. Through a server action and a soft navigation they outlived the
  // session — one more request without it, and a cached 401 that signed the next session out. No
  // `redirectTo`: the response redirects, and Refine must not navigate on its own meanwhile.
  logout: async (): Promise<AuthActionResponse> => {
    const form = document.createElement('form');

    form.method = 'post';
    form.action = LOGOUT_PATH;
    document.body.appendChild(form);
    form.submit();

    return { success: true };
  },
  // A failed action reaches Refine through `unwrapActionResult`, which puts its status in `statusCode`.
  onError: async (error: any): Promise<OnErrorResponse> => {
    if (isSignedOut(error?.statusCode)) {
      return { logout: true };
    }

    return { error };
  },
};
