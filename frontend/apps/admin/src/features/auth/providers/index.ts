'use client';

import { checkAccess, login, logout, me } from '@/features/auth/actions';
import type { AuthActionResponse, AuthProvider, OnErrorResponse } from '@refinedev/core';

type LoginParams = {
  email: string;
  password: string;
  remember?: boolean;
};

export const authProvider: AuthProvider = {
  check: async () => checkAccess(),
  getIdentity: async () => me(),
  login: async (params: LoginParams): Promise<AuthActionResponse> => {
    return login({ login: params.email, password: params.password });
  },
  logout: async () => logout(),
  onError: async (error: any): Promise<OnErrorResponse> => {
    if ([401, 403].includes(error.response?.status)) {
      return { logout: true };
    }

    return { error };
  },
};
