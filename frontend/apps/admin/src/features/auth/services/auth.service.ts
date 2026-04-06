import { ConfigService } from '@/common/services/config.service';
import { GrpcAuthData, GrpcAuthLogin, GrpcAuthProxyRepository, GrpcUserRole } from '@frontend/grpc';
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

  private async setAuthCookies(authData: GrpcAuthData) {
    const cookieStore = await cookies();

    const accessToken = authData.tokens.accessToken.value;
    const accessExpireDate = authData.tokens.accessToken.expireDate;

    cookieStore.set('userId', authData.user.id, {
      ...this.cookieConfig,
      expires: accessExpireDate,
    });

    cookieStore.set('role', authData.user.role, {
      ...this.cookieConfig,
      expires: accessExpireDate,
    });

    cookieStore.set('access-token', accessToken, {
      ...this.cookieConfig,
      expires: accessExpireDate,
    });

    cookieStore.set('refresh-token', authData.tokens.refreshToken.value, {
      ...this.cookieConfig,
      expires: authData.tokens.refreshToken.expireDate,
    });

    return {
      accessToken,
      userId: authData.user.id,
    };
  }

  private async getAccessToken() {
    const cookieStore = await cookies();

    const accessToken = cookieStore.get('access-token');
    const role = cookieStore.get('role');

    if (!accessToken?.value || role?.value !== GrpcUserRole.ADMIN) {
      throw new Error('Forbidden');
    }

    return accessToken.value;
  }

  private async getUserId() {
    const cookieStore = await cookies();

    const userId = cookieStore.get('userId');
    const role = cookieStore.get('role');

    if (!userId?.value || role?.value !== GrpcUserRole.ADMIN) {
      throw new Error('Forbidden');
    }

    return userId.value;
  }

  private async getAccessTokenSafe() {
    try {
      return this.getAccessToken();
    } catch (error) {
      return null;
    }
  }

  private async getUserIdSafe() {
    try {
      return this.getUserId();
    } catch (error) {
      return null;
    }
  }

  private async getRefreshToken() {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh-token');

    if (!refreshToken?.value) {
      throw new Error('Forbidden');
    }

    return refreshToken.value;
  }

  private async getAccessTokenWithRefresh() {
    let accessToken = await this.getAccessTokenSafe();

    if (!accessToken) {
      const authData = await this.refreshAuthData();
      accessToken = authData.accessToken;
    }

    return accessToken;
  }

  async hasAuth() {
    try {
      const accessToken = await this.getAccessTokenWithRefresh();
      return !!accessToken;
    } catch (error) {
      return false;
    }
  }

  async login(data: GrpcAuthLogin) {
    const authData = await this.authRepository.login(data);
    return this.setAuthCookies(authData);
  }

  async refreshAuthData() {
    const refreshToken = await this.getRefreshToken();
    const authData = await this.authRepository.refreshToken({ refreshToken });

    if (authData.user.role !== GrpcUserRole.ADMIN) {
      throw new Error('Forbidden');
    }

    return this.setAuthCookies(authData);
  }

  async getCurrentUser() {
    const accessToken = await this.getAccessTokenWithRefresh();
    return this.authRepository.me({ accessToken });
  }

  async getCurrentUserId() {
    let userId = await this.getUserIdSafe();

    if (!userId) {
      const authData = await this.refreshAuthData();
      userId = authData.userId;
    }

    return userId;
  }

  async clearCookies() {
    const cookieStore = await cookies();

    cookieStore.delete({ name: 'access-token', path: this.cookieConfig.path });
    cookieStore.delete({ name: 'refresh-token', path: this.cookieConfig.path });
    cookieStore.delete({ name: 'role', path: this.cookieConfig.path });
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
