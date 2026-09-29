import { ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';

/**
 * The end client's address, set by the admin's Next server on the calls it makes without a
 * user (login / refresh). The gateway's only gRPC client is that server, so the peer address alone
 * is one key for every visitor. Trusted because the gRPC port is reachable from the private
 * network only.
 */
export const CLIENT_IP_METADATA_KEY = 'x-client-ip';

/** Per user, across every authenticated unary handler. */
export const DEFAULT_THROTTLE = {
  ttl: 60 * 1000,
  limit: 100,
} satisfies ThrottlerOptions;

/** Per client address, across every public handler — login and refresh, a password guess each. */
export const PUBLIC_THROTTLE = {
  ttl: 60 * 1000,
  limit: 10,
} satisfies ThrottlerOptions;

/** Every controller runs `DEFAULT_THROTTLE`; `@PublicGrpcController()` overrides it. */
export const GRPC_THROTTLER_OPTIONS: ThrottlerModuleOptions = {
  throttlers: [DEFAULT_THROTTLE],
  errorMessage: 'Too many requests',
};
