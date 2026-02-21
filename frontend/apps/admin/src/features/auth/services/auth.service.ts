import { ConfigService } from '@/common/services/config.service';
import { GrpcAuthData, GrpcAuthLogin, GrpcAuthRepository, GrpcUserRole } from '@frontend/grpc';
import { Metadata } from '@grpc/grpc-js';
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies } from 'next/headers';

export class AuthService {
  private readonly cookieConfig: Partial<ResponseCookie>;
  private readonly authRepository: GrpcAuthRepository;

  constructor(private readonly configService: ConfigService) {
    this.cookieConfig = {
      path: '/',
      httpOnly: true,
      secure: !configService.isDevelopment,
    };

    this.authRepository = new GrpcAuthRepository(configService.getGrpcUrl());
  }

  private async setAuthCookies(authData: GrpcAuthData) {
    const cookieStore = await cookies();

    const accessToken = authData.tokens.accessToken.value;
    const accessExpireDate = authData.tokens.accessToken.expireDate;

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

    return accessToken;
  }

  async getAccessToken() {
    const cookieStore = await cookies();

    const accessToken = cookieStore.get('access-token');
    const role = cookieStore.get('role');

    if (!accessToken?.value || role?.value !== GrpcUserRole.ADMIN) {
      throw new Error('Forbidden');
    }

    return accessToken.value;
  }

  async getAccessTokenSafe() {
    try {
      return this.getAccessToken();
    } catch (error) {
      return null;
    }
  }

  async hasAuth() {
    try {
      const accessToken = await this.getAccessToken();
      return !!accessToken;
    } catch (error) {
      return false;
    }
  }

  async getRefreshToken() {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh-token');

    if (!refreshToken?.value) {
      throw new Error('Forbidden');
    }

    return refreshToken.value;
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
    let accessToken = await this.getAccessTokenSafe();

    if (!accessToken) {
      accessToken = await this.refreshAuthData();
    }

    return this.authRepository.me({ accessToken });
  }

  async clearCookies() {
    const cookieStore = await cookies();

    cookieStore.delete({ name: 'access-token', path: this.cookieConfig.path });
    cookieStore.delete({ name: 'refresh-token', path: this.cookieConfig.path });
    cookieStore.delete({ name: 'role', path: this.cookieConfig.path });
  }

  async getAuthMetadata() {
    const accessToken = await this.getAccessToken();
    const meta = new Metadata();
    meta.set('access-token', accessToken);
    return meta;
  }
}
