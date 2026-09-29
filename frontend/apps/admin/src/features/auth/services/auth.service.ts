import { getHeadersIp } from '@/common/helpers/request.helpers';
import { ConfigService } from '@/common/services/config.service';
import { sessionEndedError, toRefreshError } from '@/features/auth/helpers/session-error';
import { createServiceError } from '@/features/grpc/helpers/service-error';
import { ClientAuth, GrpcAuthPublicRepository, GrpcUserWebRepository } from '@frontend/proto';
import { Metadata, status as GrpcStatus } from '@grpc/grpc-js';
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies, headers } from 'next/headers';

export class AuthService {
  private readonly cookieConfig: Partial<ResponseCookie>;
  private readonly authRepository: GrpcAuthPublicRepository;
  private readonly userRepository: GrpcUserWebRepository;

  constructor(private readonly configService: ConfigService) {
    this.cookieConfig = {
      path: '/',
      httpOnly: true,
      secure: !configService.isDevelopment,
    };

    this.authRepository = new GrpcAuthPublicRepository(configService.getGrpcUrl());
    this.userRepository = new GrpcUserWebRepository(configService.getGrpcUrl());
  }

  private async getCurrentAuthData() {
    const cookieStore = await cookies();

    const userId = cookieStore.get('userId');
    const role = cookieStore.get('role');
    const accessToken = cookieStore.get('access-token');
    const refreshToken = cookieStore.get('refresh-token');

    const invalidRole = role?.value ? role.value !== ClientAuth.UserRole.ADMIN : false;

    return {
      values: {
        userId: userId?.value,
        role: role?.value,
        accessToken: accessToken?.value,
        refreshToken: refreshToken?.value,
      },
      invalidRole,
    };
  }

  // The gateway rate-limits a call without a user by this address; every call it gets comes
  // from this server, so without it all visitors would share one limit.
  private async getClientMetadata() {
    const meta = new Metadata();
    const clientIp = getHeadersIp(await headers());

    if (clientIp) {
      meta.set('x-client-ip', clientIp);
    }

    return meta;
  }

  private async setAuthCookies(authData: ClientAuth.AuthData) {
    const cookieStore = await cookies();

    const userId = authData.user.id;
    const role = authData.user.role;

    const accessToken = authData.tokens.accessToken.value;
    const accessExpireDate = authData.tokens.accessToken.expiredAt;

    const refreshToken = authData.tokens.refreshToken.value;
    const refreshExpireDate = authData.tokens.refreshToken.expiredAt;

    cookieStore.set({
      name: 'userId',
      value: userId,
      expires: accessExpireDate,
      ...this.cookieConfig,
    });

    cookieStore.set({
      name: 'role',
      value: role,
      expires: accessExpireDate,
      ...this.cookieConfig,
    });

    cookieStore.set({
      name: 'access-token',
      value: accessToken,
      expires: accessExpireDate,
      ...this.cookieConfig,
    });

    cookieStore.set({
      name: 'refresh-token',
      value: refreshToken,
      expires: refreshExpireDate,
      ...this.cookieConfig,
    });

    return {
      userId,
      role,
      accessToken,
      refreshToken,
    };
  }

  // Throws a gRPC status, never a plain Error: `runAction` and `errorResponse` answer a missing or
  // refused token with the 401 the auth provider reads as logged out, not with a 500.
  private async refreshAuthData(refreshToken?: string) {
    if (!refreshToken) {
      throw sessionEndedError('Refresh token is missing');
    }

    const authData = await this.authRepository
      .refreshToken({ refreshToken }, await this.getClientMetadata())
      .catch((error: unknown) => {
        throw toRefreshError(error);
      });

    if (authData.user.role !== ClientAuth.UserRole.ADMIN) {
      throw createServiceError(GrpcStatus.PERMISSION_DENIED, 'Invalid role');
    }

    return this.setAuthCookies(authData);
  }

  private async getAccessTokenWithRefresh() {
    const { values } = await this.getCurrentAuthData();

    if (!values.accessToken) {
      const authData = await this.refreshAuthData(values.refreshToken);
      values.accessToken = authData.accessToken;
    }

    return values.accessToken;
  }

  async hasAuth() {
    try {
      const { values, invalidRole } = await this.getCurrentAuthData();

      if (invalidRole) {
        return false;
      }

      return !!values.accessToken;
    } catch (error) {
      return false;
    }
  }

  async hasAuthWithRefresh() {
    try {
      const accessToken = await this.getAccessTokenWithRefresh();
      return !!accessToken;
    } catch (error) {
      return false;
    }
  }

  async login(data: ClientAuth.AuthLogin) {
    const authData = await this.authRepository.login(data, await this.getClientMetadata());
    await this.setAuthCookies(authData);
  }

  async getCurrentUser() {
    const accessToken = await this.getAccessTokenWithRefresh();
    const meta = new Metadata();
    meta.set('access-token', accessToken);
    return this.userRepository.getOne({}, meta);
  }

  async getCurrentUserId() {
    const { values } = await this.getCurrentAuthData();

    if (!values.userId) {
      const authData = await this.refreshAuthData(values.refreshToken);
      values.userId = authData.userId;
    }

    return values.userId;
  }

  async clearCookies() {
    const cookieStore = await cookies();

    ['userId', 'role', 'access-token', 'refresh-token'].forEach((name) => {
      cookieStore.delete({ name, path: this.cookieConfig.path });
    });
  }

  async getAuthMetadata() {
    const accessToken = await this.getAccessTokenWithRefresh();
    const meta = new Metadata();
    meta.set('access-token', accessToken);
    return meta;
  }
}
