import { ConfigService } from '@/common/services/config.service';
import { ClientAuth, GrpcAuthProxyRepository } from '@frontend/proto';
import { Metadata } from '@grpc/grpc-js';
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies } from 'next/headers';

export class AuthService {
  private readonly cookieConfig: Partial<ResponseCookie>;
  private readonly authRepository: GrpcAuthProxyRepository;

  constructor(private readonly configService: ConfigService) {
    this.cookieConfig = {
      path: '/',
      httpOnly: true,
      secure: !configService.isDevelopment,
    };

    this.authRepository = new GrpcAuthProxyRepository(configService.getGrpcUrl());
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

  private async setAuthCookies(authData: ClientAuth.AuthData) {
    const cookieStore = await cookies();

    const userId = authData.user.id;
    const role = authData.user.role;

    const accessToken = authData.tokens.accessToken.value;
    const accessExpireDate = authData.tokens.accessToken.expireDate;

    const refreshToken = authData.tokens.refreshToken.value;
    const refreshExpireDate = authData.tokens.refreshToken.expireDate;

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

  private async refreshAuthData(refreshToken?: string) {
    if (!refreshToken) {
      throw new Error('Forbidden');
    }

    const authData = await this.authRepository.refreshToken({ refreshToken });

    if (authData.user.role !== ClientAuth.UserRole.ADMIN) {
      throw new Error('Forbidden');
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
    const authData = await this.authRepository.login(data);
    await this.setAuthCookies(authData);
  }

  async getCurrentUser() {
    const accessToken = await this.getAccessTokenWithRefresh();
    return this.authRepository.me({ accessToken });
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

  async getStreamAuthMetadata() {
    const accessToken = await this.getAccessTokenWithRefresh();
    const { code } = await this.authRepository.generateStreamCode({ accessToken });
    const meta = new Metadata();
    meta.set('stream-code', code);
    return meta;
  }
}
