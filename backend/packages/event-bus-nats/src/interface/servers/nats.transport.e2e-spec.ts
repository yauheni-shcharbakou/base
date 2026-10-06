import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { EventBusHost } from '@backend/event-bus';
import { NestAuth } from '@backend/proto';
import { ConsumerInfo, JetStreamManager, jetstreamManager } from '@nats-io/jetstream';
import { NatsConnection } from '@nats-io/nats-core';
import { connect } from '@nats-io/transport-node';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Ctx, Payload } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { NatsUserCreateEventHandler, NatsUserTransport } from '@/generated';
import { NATS_MICROSERVICE_OPTIONS } from '@/infrastructure';
import { NatsModule } from '@/nats.module';
import { NatsMessageContext } from '../contexts';
import { NatsController, NatsEvent } from '../decorators';

const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';
const STREAM = 'auth-user-stream';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Whether `test/nats-broker.setup.ts` found a broker to run against. */
    natsBroker: boolean;
  }
}

// `test/nats-broker.setup.ts` probes the broker before the workers start. Skipping outright beats
// a suite that passes because it silently did nothing.
const describeWithBroker = describe.skipIf(!inject('natsBroker'));

type Received = { event: NestAuth.User; delivery: number; durable: string };

const recorder: Record<'file' | 'object' | 'failing', Received[]> = {
  file: [],
  object: [],
  failing: [],
};

const record = (
  bucket: keyof typeof recorder,
  event: NestAuth.User,
  context: NatsMessageContext,
) => {
  recorder[bucket].push({
    event,
    delivery: context.getDeliveryCount(),
    durable: context.getDurable(),
  });
};

// Three controllers, one event, three consumer ids — the shape the whole adapter exists for.
// None of them acks: that is `NatsControllerInterceptor`'s job, and proving it does it is half
// the point of this suite. Each subscribes to that one event with `@NatsEvent`:
// `ControllerMethods()` would bind every event of the service, and a class lacking a handler for
// one fails to load.

@NatsController({ consumer: 'storage.file' })
class FileController implements NatsUserCreateEventHandler {
  @NatsEvent(NatsUserTransport.CREATE)
  onUserCreate(@Payload() event: NestAuth.User, @Ctx() context: NatsMessageContext): void {
    record('file', event, context);
  }
}

@NatsController({ consumer: 'storage.storage-object' })
class StorageObjectController implements NatsUserCreateEventHandler {
  @NatsEvent(NatsUserTransport.CREATE)
  onUserCreate(@Payload() event: NestAuth.User, @Ctx() context: NatsMessageContext): void {
    record('object', event, context);
  }
}

@NatsController({ consumer: 'storage.failing' })
class FailingController implements NatsUserCreateEventHandler {
  @NatsEvent(NatsUserTransport.CREATE)
  onUserCreate(@Payload() event: NestAuth.User, @Ctx() context: NatsMessageContext): void {
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

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

describeWithBroker('NATS transport (live broker)', () => {
  const user: NestAuth.User = {
    id: '01JE2ETEST0000000000000000',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    email: 'e2e@example.com',
    role: NestAuth.UserRole.ADMIN,
  };

  let app: INestApplication;
  // A single observer connection for the assertions, so the suite leaves no open handle behind
  // and the worker can exit on its own.
  let probe: NatsConnection;
  let manager: JetStreamManager;
  let consumers: ConsumerInfo[];

  beforeAll(async () => {
    probe = await connect({ servers: [NATS_URL] });
    manager = await jetstreamManager(probe);

    // Wipe the stream, and with it every durable, so a rerun is not fed the previous run's
    // history — `deliver_policy: all` would replay it into the freshly created consumers.
    try {
      await manager.streams.delete(STREAM);
    } catch {
      // Not there yet: the provisioner is about to create it.
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        NatsModule.forRoot({ host: EventBusHost.AUTH }),
        NatsModule.forFeature({ EventBus: NatsUserTransport.EventBus }),
      ],
      controllers: [FileController, StorageObjectController, FailingController],
    }).compile();

    // The same bootstrap a service runs in `main.ts`.
    app = moduleRef.createNestApplication();
    app.connectMicroservice(app.get(NATS_MICROSERVICE_OPTIONS));

    await app.startAllMicroservices();
    await app.init();

    await app.get(NatsUserTransport.EventBus).emitCreate(user);

    await waitFor(
      () =>
        recorder.file.length >= 1 && recorder.object.length >= 1 && recorder.failing.length >= 3,
    );

    // A beat past the last expected delivery, so a wrong extra redelivery still shows up below.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    consumers = await manager.consumers.list(STREAM).next();
  });

  afterAll(async () => {
    await app?.close();
    await probe?.close();
  });

  // With every subject of the host, not only the one this suite emits.
  it('declares the stream the emitting host owns', async () => {
    const info = await manager.streams.info(STREAM);

    expect(info.config.subjects).toEqual(['auth-user-create', 'auth-user-delete']);
    expect(info.state.messages).toBe(1);
  });

  it('creates one durable per (subject, consumer id)', () => {
    expect(consumers.map((consumer) => consumer.name).sort()).toEqual([
      'storage-failing-auth-user-create',
      'storage-file-auth-user-create',
      'storage-storage-object-auth-user-create',
    ]);
  });

  it('fans the event out to every subscriber instead of load-balancing it', () => {
    expect(recorder.file).toHaveLength(1);
    expect(recorder.object).toHaveLength(1);
  });

  it('delivers the payload as JSON, so a Date arrives as an ISO string', () => {
    // The bus is JSON end to end, here and in `@backend/event-bus-redis`. `NestAuth.User.createdAt` is
    // typed `Date`, but what a subscriber actually receives is the serialized form.
    expect(recorder.file[0].event).toEqual(JSON.parse(JSON.stringify(user)));
    expect(recorder.file[0].event.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('injects the subscription context into the handler', () => {
    expect(recorder.file[0].durable).toBe('storage-file-auth-user-create');
    expect(recorder.object[0].durable).toBe('storage-storage-object-auth-user-create');
  });

  it('acks through the interceptor, leaving nothing pending', () => {
    const acked = consumers.filter(
      (consumer) => consumer.name !== 'storage-failing-auth-user-create',
    );

    expect(acked).toHaveLength(2);

    for (const consumer of acked) {
      expect(consumer.num_pending).toBe(0);
      expect(consumer.num_ack_pending).toBe(0);
    }
  });

  it('naks a throwing handler and stops redelivering at max_deliver', () => {
    expect(recorder.failing.map((item) => item.delivery)).toEqual([1, 2, 3]);
  });
});
