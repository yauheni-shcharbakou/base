import { EventBusHost } from '@backend/event-bus';
import { NestAuth } from '@backend/proto';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Ctx, Payload } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import IORedis from 'ioredis';
import { RedisUserCreateEventHandler, RedisUserTransport } from '@/generated';
import { REDIS_CLIENT, REDIS_MICROSERVICE_OPTIONS, RedisQueueClient } from '@/infrastructure';
import { RedisModule } from '@/redis.module';
import { RedisJobContext } from '../contexts';
import { RedisController, RedisEvent } from '../decorators';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const EVENT_ID = 'auth.user.create';

// `test/redis-server.setup.js` probes the server before the workers fork. Skipping outright beats
// a suite that passes because it silently did nothing.
const describeWithServer = process.env.REDIS_E2E_SERVER === '1' ? describe : describe.skip;

type Received = {
  event: NestAuth.User;
  queueName: string;
  consumerId: string;
  eventId: string;
};

const recorder: Record<'file' | 'object' | 'failing', Received[]> = {
  file: [],
  object: [],
  failing: [],
};

const record = (bucket: keyof typeof recorder, event: NestAuth.User, context: RedisJobContext) => {
  recorder[bucket].push({
    event,
    queueName: context.getQueueName(),
    consumerId: context.getConsumerId(),
    eventId: context.getEventId(),
  });
};

// Three controllers, one event, three consumer ids — the shape the mediator exists for. BullMQ
// hands a job to exactly one worker, so without the fan-out stage these three would share it. Each
// subscribes to that one event with `@RedisEvent`, as the services do: `ControllerMethods()` would
// bind every event of the service, and a class lacking a handler for one fails to load.

@RedisController({ consumer: 'storage.file' })
class FileController implements RedisUserCreateEventHandler {
  @RedisEvent(RedisUserTransport.CREATE)
  onUserCreate(@Payload() event: NestAuth.User, @Ctx() context: RedisJobContext): void {
    record('file', event, context);
  }
}

@RedisController({ consumer: 'storage.storage-object' })
class StorageObjectController implements RedisUserCreateEventHandler {
  @RedisEvent(RedisUserTransport.CREATE)
  onUserCreate(@Payload() event: NestAuth.User, @Ctx() context: RedisJobContext): void {
    record('object', event, context);
  }
}

@RedisController({ consumer: 'storage.failing' })
class FailingController implements RedisUserCreateEventHandler {
  @RedisEvent(RedisUserTransport.CREATE)
  onUserCreate(@Payload() event: NestAuth.User, @Ctx() context: RedisJobContext): void {
    record('failing', event, context);

    throw new Error('handler blew up');
  }
}

const waitFor = async (predicate: () => boolean, timeoutMs = 15000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;

  while (!predicate()) {
    if (Date.now() > deadline) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

describeWithServer('Redis transport (live server)', () => {
  const user: NestAuth.User = {
    id: '01JE2ETEST0000000000000000',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    email: 'e2e@example.com',
    role: NestAuth.UserRole.ADMIN,
  };

  let app: INestApplication;
  // A single observer connection for the assertions, so the suite leaves no open handle behind.
  let probe: IORedis;
  let client: RedisQueueClient;
  let failedJobs: Job[];

  beforeAll(async () => {
    probe = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

    // Wipe what the previous run left, so the registry starts empty and every subscription counts
    // as brand new. Scoped twice over: to the e2e prefixes the global setup pinned, so the
    // developer's own `bull:*` / `event-bus:*` keys are never in range, and to this file's event,
    // so it cannot pull the rug from under a sibling suite running in another worker.
    const keys = [
      ...(await probe.keys(`bull-e2e:${EVENT_ID}*`)),
      ...(await probe.keys(`event-bus-e2e:*:${EVENT_ID}`)),
    ];

    if (keys.length) {
      await probe.del(...keys);
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        RedisModule.forRoot({ host: EventBusHost.AUTH }),
        RedisModule.forFeature({ EventBus: RedisUserTransport.EventBus }),
      ],
      controllers: [FileController, StorageObjectController, FailingController],
    }).compile();

    // The same bootstrap a service runs in `main.ts`.
    app = moduleRef.createNestApplication();
    app.connectMicroservice(app.get(REDIS_MICROSERVICE_OPTIONS));

    await app.startAllMicroservices();
    await app.init();

    client = app.get(REDIS_CLIENT);

    await app.get(RedisUserTransport.EventBus).emitCreate(user);

    await waitFor(
      () =>
        recorder.file.length >= 1 && recorder.object.length >= 1 && recorder.failing.length >= 3,
    );

    // A beat past the last expected attempt, so a wrong extra redelivery still shows up below.
    await new Promise((resolve) => setTimeout(resolve, 500));

    failedJobs = await client.getQueue(`${EVENT_ID}@storage.failing`).getFailed();
  });

  afterAll(async () => {
    await app?.close();
    await probe?.quit();
  });

  it('registers every consumer of the event in the subscription registry', async () => {
    const consumerIds = await probe.smembers(`event-bus-e2e:subs:${EVENT_ID}`);

    expect(consumerIds.sort()).toEqual([
      'storage.failing',
      'storage.file',
      'storage.storage-object',
    ]);
  });

  it('fans the event out to every subscriber instead of load-balancing it', () => {
    expect(recorder.file).toHaveLength(1);
    expect(recorder.object).toHaveLength(1);
  });

  it('delivers through a queue of its own per consumer', () => {
    expect(recorder.file[0].queueName).toBe(`${EVENT_ID}@storage.file`);
    expect(recorder.object[0].queueName).toBe(`${EVENT_ID}@storage.storage-object`);
  });

  it('injects the subscription context into the handler', () => {
    expect(recorder.file[0].eventId).toBe(EVENT_ID);
    expect(recorder.file[0].consumerId).toBe('storage.file');
    expect(recorder.object[0].consumerId).toBe('storage.storage-object');
  });

  it('delivers the payload as JSON, so a Date arrives as an ISO string', () => {
    // The bus is JSON end to end, here and in `@backend/event-bus-nats`. `NestAuth.User.createdAt` is
    // typed `Date`, but what a subscriber actually receives is the serialized form.
    expect(recorder.file[0].event).toEqual(JSON.parse(JSON.stringify(user)));
    expect(recorder.file[0].event.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('retries a throwing handler up to the configured attempts, then stops', () => {
    expect(recorder.failing).toHaveLength(3);
  });

  it('lands the exhausted job in the failed set with a readable reason', () => {
    // The whole chain has to hold for this string to survive: the interceptor resolves the
    // message while the error object still exists, wraps it in an `RpcException` so
    // `RpcExceptionsHandler` cannot replace it with "Internal server error", and the server
    // normalises whatever comes back into an `Error` — `failedReason` is `error.message`.
    expect(failedJobs).toHaveLength(1);
    expect(failedJobs[0].failedReason).toBe('handler blew up');
  });

  it('leaves nothing failed behind for the handlers that succeeded', async () => {
    const counts = await Promise.all(
      ['storage.file', 'storage.storage-object'].map((consumerId) =>
        client.getQueue(`${EVENT_ID}@${consumerId}`).getJobCounts('failed', 'active', 'waiting'),
      ),
    );

    for (const count of counts) {
      expect(count).toMatchObject({ failed: 0, active: 0, waiting: 0 });
    }
  });

  it('drains the source queue the mediator reads', async () => {
    const counts = await client.getQueue(EVENT_ID).getJobCounts('failed', 'active', 'waiting');

    expect(counts).toMatchObject({ failed: 0, active: 0, waiting: 0 });
  });
});
