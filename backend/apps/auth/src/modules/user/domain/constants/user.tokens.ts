/**
 * The `CacheService` scoped to this module's keyspace (`cache:auth:user:<id>`).
 *
 * A token rather than the global `CacheService`, so the namespace is decided once — in
 * `UserModule`, the composition root — instead of in every use-case that touches a cached user.
 * `application/` cannot reach `infrastructure/` under `layerGuard()`, which rules out a shared
 * helper there.
 */
export const USER_CACHE = Symbol('USER_CACHE');
