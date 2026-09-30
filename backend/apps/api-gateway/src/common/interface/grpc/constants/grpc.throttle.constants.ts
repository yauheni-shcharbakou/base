import { CacheService } from '@backend/cache';
import { CacheThrottlerStorage } from '@common/infrastructure/storages/cache.throttler.storage';
import { ExecutionContext } from '@nestjs/common';
import { ThrottlerAsyncOptions, ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';

/**
 * The end client's address, set by the admin's Next server on the calls it makes without a
 * user (login / refresh). The gateway's only gRPC client is that server, so the peer address alone
 * is one key for every visitor. Trusted because the gRPC port is reachable from the private
 * network only.
 */
export const CLIENT_IP_METADATA_KEY = 'x-client-ip';

/**
 * Trailing metadata of a call refused by the rate limit: whole seconds until its bucket's window
 * resets, as HTTP's `Retry-After` — what a client waits before calling again.
 */
export const RETRY_AFTER_METADATA_KEY = 'retry-after';

/**
 * The rpcs that only read, by handler name — the same in every service and audience. Each is
 * counted against `READ_THROTTLE` instead of `DEFAULT_THROTTLE`, so browsing is not held up by an
 * upload's writes, nor the other way round. A list, not a naming rule: an rpc missing from it is
 * counted as a write, the stricter of the two.
 */
export const READ_RPCS: ReadonlySet<string> = new Set([
  'getById',
  'getDownloadMap',
  'getFolderContent',
  'getFolders',
  'getList',
  'getMany',
  'getOne',
  'getRootFolder',
  'getUrlMap',
  'isExists',
  'me',
]);

export const isReadRpc = (context: ExecutionContext): boolean =>
  READ_RPCS.has(context.getHandler().name);

/** Per user, across every authenticated unary handler that writes. */
export const DEFAULT_THROTTLE = {
  name: 'default',
  ttl: 60 * 1000,
  limit: 100,
  skipIf: isReadRpc,
} satisfies ThrottlerOptions;

/**
 * Per user, across every authenticated unary handler that only reads (`READ_RPCS`). Looser: a
 * folder page, its previews and the gallery's originals are one read each, and a page is not left
 * waiting on a batch upload's writes.
 */
export const READ_THROTTLE = {
  name: 'read',
  ttl: 60 * 1000,
  limit: 300,
  skipIf: (context: ExecutionContext) => !isReadRpc(context),
} satisfies ThrottlerOptions;

/**
 * Per client address, across every public handler — login and refresh, a password guess each.
 * Overrides the limits of both buckets, a read among them too.
 */
export const PUBLIC_THROTTLE = {
  ttl: 60 * 1000,
  limit: 10,
} satisfies ThrottlerOptions;

/**
 * Every controller runs both, each call counted by one of them; `@PublicGrpcController()`
 * overrides their limits.
 */
export const GRPC_THROTTLER_OPTIONS: ThrottlerModuleOptions = {
  throttlers: [DEFAULT_THROTTLE, READ_THROTTLE],
  errorMessage: 'Too many requests',
};

/** The module registration: the options above, counted in Redis under `<prefix>:<namespace>:throttle`. */
export const GRPC_THROTTLER_MODULE_OPTIONS: ThrottlerAsyncOptions = {
  inject: [CacheService],
  useFactory: (cache: CacheService): ThrottlerModuleOptions => ({
    ...GRPC_THROTTLER_OPTIONS,
    storage: new CacheThrottlerStorage(cache.scope('throttle')),
  }),
};
