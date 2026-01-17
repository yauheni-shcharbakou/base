'use client';

import { checkAccess, login, logout, me } from '@/actions/auth.actions';
import type {
  AuthActionResponse,
  AuthProvider,
  CheckResponse,
  IdentityResponse,
  OnErrorResponse,
} from '@refinedev/core';
import _ from 'lodash';

type LoginParams = {
  email: string;
  password: string;
  remember?: boolean;
};

export const authProvider: AuthProvider = {
  check: async (params: any): Promise<CheckResponse> => checkAccess(),
  getIdentity: async (params: any): Promise<IdentityResponse> => me(),
  login: async (params: LoginParams): Promise<AuthActionResponse> => {
    return login({
      login: params.email,
      password: params.password,
    });
  },
  logout: async (params: any): Promise<AuthActionResponse> => logout(),
  onError: async (error: any): Promise<OnErrorResponse> => {
    if (_.includes([401, 403], error.response?.status)) {
      return {
        logout: true,
      };
    }

    return { error };
  },
};
