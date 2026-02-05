import { config } from '@/config';
import { authGrpcRepository } from '@/repositories';
import { GrpcAuthData, GrpcUserRole } from '@frontend/grpc';
import { Metadata } from '@grpc/grpc-js';
import _ from 'lodash';
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies } from 'next/headers';

export const getTokenData = (authData: GrpcAuthData) => {
  return {
    access: _.get(authData, 'tokens.accessToken')!,
    refresh: _.get(authData, 'tokens.refreshToken')!,
  };
};

export const clearCookies = async () => {
  const cookieStore = await cookies();

  cookieStore.delete({ name: 'access-token', path: '/' });
  cookieStore.delete({ name: 'refresh-token', path: '/' });
  cookieStore.delete({ name: 'role', path: '/' });
};

export const cookieConfig: Partial<ResponseCookie> = {
  path: '/',
  httpOnly: true,
  secure: !config.isDevelopment,
};

export const checkAccessToken = async (): Promise<string | null> => {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get('access-token');
  const role = cookieStore.get('role');

  if (accessToken?.value && role?.value !== GrpcUserRole.ADMIN) {
    throw new Error('Forbidden');
  }

  if (!accessToken?.value) {
    return null;
  }

  return accessToken.value;
};

export const checkRefreshToken = async () => {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh-token');

  if (!refreshToken?.value) {
    throw new Error('Forbidden');
  }

  return refreshToken.value;
};

export const setAuthCookies = async (authData: GrpcAuthData) => {
  const cookieStore = await cookies();
  const { access, refresh } = getTokenData(authData);

  cookieStore.set('role', authData.user!.role, {
    ...cookieConfig,
    expires: access.expireDate,
  });

  cookieStore.set('access-token', access.value, {
    ...cookieConfig,
    expires: access.expireDate,
  });

  cookieStore.set('refresh-token', refresh.value, {
    ...cookieConfig,
    expires: refresh.expireDate,
  });

  return access.value;
};

export const refreshAuthData = async (): Promise<string> => {
  const refreshToken = await checkRefreshToken();
  const authData = await authGrpcRepository.refreshToken({ refreshToken });

  if (authData.user?.role !== GrpcUserRole.ADMIN) {
    throw new Error('Forbidden');
  }

  return setAuthCookies(authData);
};

export const getAuthMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access-token');
  const role = cookieStore.get('role');

  if (!accessToken?.value || role?.value !== GrpcUserRole.ADMIN) {
    throw new Error('Forbidden');
  }

  const meta = new Metadata();
  meta.set('access-token', accessToken.value);
  return meta;
};
