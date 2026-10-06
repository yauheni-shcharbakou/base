import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { EventBusHost, FilePurgeType } from '@backend/event-bus';
import type { FilePurgeEvent } from '@backend/event-bus';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Payload } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import IORedis from 'ioredis';
import { RedisFilePurgeEventHandler, RedisFileTransport } from '@/generated';
import { REDIS_MICROSERVICE_OPTIONS } from '@/infrastructure';
import { RedisModule } from '@/redis.module';
import { RedisController, RedisEvent } from '../decorators';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const EVENT_ID = 'storage.file.purge';
const CONSUMER_ID = 'storage.e2e-file';
const PARKING_KEY = `event-bus-e2e:parked:${EVENT_ID}`;
const SUBSCRIPTION_KEY = `event-bus-e2e:subs:${EVENT_ID}`;

// A different host and event from `redis.transport.e2e-spec.ts`, so the two files cannot disturb
// each other even when Vitest runs them in parallel.
const describeWithServer = describe.skipIf(!inject('redisServer'));

const received: FilePurgeEvent[] = [];

// One event through `@RedisEvent`, as the services subscribe: `ControllerMethods()` would bind
// every event of the `file` service, and this class handles only `purge`.
@RedisController({ consumer: CONSUMER_ID })
class FileController implements RedisFilePurgeEventHandler {
  @RedisEvent(RedisFileTransport.PURGE)
  onFilePurge(@Payload() event: FilePurgeEvent): void {
    received.push(event);
  }
}

const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 15000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;

  while (!(await predicate())) {
    if (Date.now() > deadline) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

/** The emitting side: owns the event, runs its mediator, has no subscribers of its own. */
const startEmitter = async (): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      RedisModule.forRoot({ host: EventBusHost.STORAGE, onlyEmitting: true }),
      RedisModule.forFeature({ EventBus: RedisFileTransport.EventBus }),
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return app;
};

/** The subscribing side, booted exactly the way a service does it in `main.ts`. */
const startSubscriber = async (): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      RedisModule.forRoot({ host: EventBusHost.STORAGE }),
    ],
    controllers: [FileController],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.connectMicroservice(app.get(REDIS_MICROSERVICE_OPTIONS));

  await app.startAllMicroservices();
  await app.init();

  return app;
};

describeWithServer('Redis parking (live server)', () => {
  const purge = {
    type: FilePurgeType.FILE,
    providerId: 'dev/01JE2EUSER000000000000000/parked.png',
  } satisfies FilePurgeEvent;

  let probe: IORedis;
  let parkedBeforeReplay: string[];
  let ttlBeforeReplay: number;

  beforeAll(async () => {
    probe = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

    // Start from nothing: the subscription must count as brand new for the replay to run at all.
    // Scoped to this file's event, so wiping cannot disturb a sibling suite in another worker.
    const keys = [
      ...(await probe.keys(`bull-e2e:${EVENT_ID}*`)),
      ...(await probe.keys(`event-bus-e2e:*:${EVENT_ID}`)),
    ];

    if (keys.length) {
      await probe.del(...keys);
    }

    // 1. Emit while nobody is subscribed — the first-boot race, reproduced.
    const emitter = await startEmitter();
    await emitter.get(RedisFileTransport.EventBus).emitPurge(purge);

    await waitFor(async () => (await probe.llen(PARKING_KEY)) > 0);

    parkedBeforeReplay = await probe.lrange(PARKING_KEY, 0, -1);
    ttlBeforeReplay = await probe.ttl(PARKING_KEY);

    await emitter.close();
  });

  afterAll(async () => {
    await probe?.quit();
  });

  it('parks the event instead of dropping it', () => {
    expect(parkedBeforeReplay).toHaveLength(1);
    expect(JSON.parse(parkedBeforeReplay[0])).toMatchObject({
      data: purge,
    });
  });

  it('bounds the parking list by a TTL', () => {
    expect(ttlBeforeReplay).toBeGreaterThan(0);
    expect(ttlBeforeReplay).toBeLessThanOrEqual(86400);
  });

  it('registers no consumer while there is none', async () => {
    await expect(probe.smembers(SUBSCRIPTION_KEY)).resolves.toEqual([]);
  });

  describe('once a subscriber registers for the first time', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await startSubscriber();
      await waitFor(() => received.length > 0);
      await app.close();
    });

    it('replays the parked event into the new consumer queue', () => {
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(purge);
    });

    it('publishes the subscription so later events skip the parking entirely', async () => {
      await expect(probe.smembers(SUBSCRIPTION_KEY)).resolves.toEqual([CONSUMER_ID]);
    });

    // Non-destructive on purpose: a second brand-new consumer of the same event needs the very
    // same entries, and there is no safe moment to delete them for everyone.
    it('leaves the parked entry in place', async () => {
      await expect(probe.lrange(PARKING_KEY, 0, -1)).resolves.toEqual(parkedBeforeReplay);
    });
  });

  describe('on a restart of the now-known subscriber', () => {
    beforeAll(async () => {
      const app = await startSubscriber();

      // Long enough for a replay to have landed and been processed, had one run.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await app.close();
    });

    it('does not deliver the parked event again', () => {
      expect(received).toHaveLength(1);
    });

    // The mechanism behind it: `SADD` no longer reports the consumer as new, so `publish()`
    // returns nothing for the replay to work with.
    it('is no longer classified as a first-ever registration', async () => {
      await expect(probe.sadd(SUBSCRIPTION_KEY, CONSUMER_ID)).resolves.toBe(0);
    });
  });
});
