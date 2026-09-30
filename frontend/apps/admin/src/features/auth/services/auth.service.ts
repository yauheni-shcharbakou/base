import { getHeadersIp } from '@/common/helpers/request.helpers';
import { ConfigService } from '@/common/services/config.service';
import { sessionEndedError, toRefreshError } from '@/features/auth/helpers/session-error';
import { type Flight, SingleFlight } from '@/features/auth/helpers/single-flight';
import { reportError } from '@/features/grpc/helpers/report-error';
import { createServiceError } from '@/features/grpc/helpers/service-error';
import { ClientAuth, GrpcAuthPublicRepository, GrpcUserWebRepository } from '@frontend/proto';
import { Metadata, status as GrpcStatus } from '@grpc/grpc-js';
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies, headers } from 'next/headers';

type HeadersReader = Pick<Headers, 'get'>;

/** Every cookie a session leaves: `setAuthCookies` writes them, `clearCookies` deletes them. */
export const AUTH_COOKIE_NAMES = ['userId', 'role', 'access-token', 'refresh-token'] as const;

// Requests the browser sent with the old cookie before a refresh's response reached it arrive
// within the page load that sent them; this long they get the same session instead of a refresh.
const REFRESH_GRACE_MS = 30_000;

// The flights live on `globalThis`, for two reasons. The middleware and the app are separate
// bundles, each with its own copy of this module, and one refresh per session holds only if both
// reach the same map. And only the map is kept there, never a `SingleFlight`: an object that
// outlives a dev reload would keep running the code it was built with.
const REFRESH_FLIGHTS_KEY = Symbol.for('frontend.admin.refresh-flights');

const getRefreshFlights = (): SingleFlight<ClientAuth.AuthData> => {
  const store = globalThis as typeof globalThis & {
    [REFRESH_FLIGHTS_KEY]?: Map<string, Flight<ClientAuth.AuthData>>;
  };

  if (!store[REFRESH_FLIGHTS_KEY]) {
    store[REFRESH_FLIGHTS_KEY] = new Map();
  }

  return new SingleFlight(REFRESH_GRACE_MS, Date.now, store[REFRESH_FLIGHTS_KEY]);
};

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
  private getClientMetadata(requestHeaders: HeadersReader) {
    const meta = new Metadata();
    const clientIp = getHeadersIp(requestHeaders);

    if (clientIp) {
      meta.set('x-client-ip', clientIp);
    }

    return meta;
  }

  /**
   * The cookies a sign-in or a refresh leaves, each expiring with its token. Written through
   * `cookies()` by an action, and through the request and the response by the middleware, where
   * `next/headers` is not there to write them.
   */
  getAuthCookies(authData: ClientAuth.AuthData): ResponseCookie[] {
    const accessExpireDate = authData.tokens.accessToken.expiredAt;
    const refreshExpireDate = authData.tokens.refreshToken.expiredAt;

    return [
      { name: 'userId', value: authData.user.id, expires: accessExpireDate },
      { name: 'role', value: authData.user.role, expires: accessExpireDate },
      { name: 'access-token', value: authData.tokens.accessToken.value, expires: accessExpireDate },
      {
        name: 'refresh-token',
        value: authData.tokens.refreshToken.value,
        expires: refreshExpireDate,
      },
    ].map((cookie) => ({ ...cookie, ...this.cookieConfig }));
  }

  private async setAuthCookies(authData: ClientAuth.AuthData) {
    const cookieStore = await cookies();

    this.getAuthCookies(authData).forEach((cookie) => cookieStore.set(cookie));

    return {
      userId: authData.user.id,
      role: authData.user.role,
      accessToken: authData.tokens.accessToken.value,
      refreshToken: authData.tokens.refreshToken.value,
    };
  }

  /**
   * A new session for a refresh token. Throws a gRPC status, never a plain Error: `runAction` and
   * `errorResponse` answer a missing or refused token with the 401 the auth provider reads as
   * logged out, not with a 500.
   *
   * One gateway call per refresh token: the parallel requests of a page each arrive without an
   * access token, and they share the first one's refresh (`SingleFlight`) rather than spending the
   * gateway's public rate limit. It is also what keeps the session: refresh tokens rotate, and
   * the gateway ends a session whose token is spent twice (ADR-0029).
   */
  async refreshSession(
    refreshToken: string | undefined,
    requestHeaders: HeadersReader,
  ): Promise<ClientAuth.AuthData> {
    if (!refreshToken) {
      throw sessionEndedError('Refresh token is missing');
    }

    return getRefreshFlights().run(refreshToken, () =>
      this.requestRefresh(refreshToken, requestHeaders),
    );
  }

  private async requestRefresh(
    refreshToken: string,
    requestHeaders: HeadersReader,
  ): Promise<ClientAuth.AuthData> {
    const authData = await this.authRepository
      .refreshToken({ refreshToken }, this.getClientMetadata(requestHeaders))
      .catch((error: unknown) => {
        throw toRefreshError(error);
      });

    if (authData.user.role !== ClientAuth.UserRole.ADMIN) {
      throw createServiceError(GrpcStatus.PERMISSION_DENIED, 'Invalid role');
    }

    return authData;
  }

  // The middleware refreshes an expired session before a request renders; this fallback is for a
  // call it did not see — the access token expiring between the two.
  private async refreshAuthData(refreshToken?: string) {
    return this.setAuthCookies(await this.refreshSession(refreshToken, await headers()));
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
    const authData = await this.authRepository.login(data, this.getClientMetadata(await headers()));
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

  /**
   * Ends the session at the gateway, so its refresh token is refused from now on even if a copy
   * survives, then drops the cookies. Best effort: a gateway that is down or rate-limiting must not
   * keep the admin signed in, so the cookies go either way — the session then lasts until its
   * token expires, and the failure is logged.
   */
  async logout() {
    const { values } = await this.getCurrentAuthData();

    if (values.refreshToken) {
      const refreshToken = values.refreshToken;

      // A refresh shared within its grace period would hand the ended session out again. It is
      // keyed by the token it was asked with, which the cookie no longer holds once the refresh
      // replaced it — so the flight that handed this token out goes too.
      getRefreshFlights().forget(
        (key, authData) =>
          key === refreshToken || authData?.tokens.refreshToken.value === refreshToken,
      );

      await this.authRepository
        .logout({ refreshToken: values.refreshToken }, this.getClientMetadata(await headers()))
        .catch(reportError);
    }

    await this.clearCookies();
  }

  async clearCookies() {
    const cookieStore = await cookies();

    AUTH_COOKIE_NAMES.forEach((name) => {
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
