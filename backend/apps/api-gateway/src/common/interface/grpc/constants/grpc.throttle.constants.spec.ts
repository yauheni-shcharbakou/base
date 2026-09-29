import 'reflect-metadata';
import { CacheModule } from '@backend/cache';
import { CacheThrottlerStorage } from '@common/infrastructure/storages/cache.throttler.storage';
import { Test } from '@nestjs/testing';
import { getStorageToken, ThrottlerModule } from '@nestjs/throttler';
import { GRPC_THROTTLER_MODULE_OPTIONS } from './grpc.throttle.constants';

// Without this the throttler silently falls back to its own per-process store.
describe('GRPC_THROTTLER_MODULE_OPTIONS', () => {
  it('registers the throttler with the cache-backed storage', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        CacheModule.forRoot({ namespace: 'api-gateway', driver: 'memory' }),
        ThrottlerModule.forRootAsync(GRPC_THROTTLER_MODULE_OPTIONS),
      ],
    }).compile();

    try {
      expect(moduleRef.get(getStorageToken())).toBeInstanceOf(CacheThrottlerStorage);
    } finally {
      await moduleRef.close();
    }
  });
});
