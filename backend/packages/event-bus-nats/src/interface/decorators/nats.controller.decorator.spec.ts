import 'reflect-metadata';
import { EventPattern } from '@nestjs/microservices';
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { globalConsumerRegistry } from '@/infrastructure';
import { NatsController } from './nats.controller.decorator';

const getPatterns = (target: { prototype: object }, method: string): string[] => {
  const descriptor = Object.getOwnPropertyDescriptor(target.prototype, method);
  return Reflect.getMetadata(PATTERN_METADATA, descriptor?.value) ?? [];
};

describe('NatsController', () => {
  beforeEach(() => {
    // The registry is a module singleton shared by every spec, so drop what previous
    // decorators left behind.
    globalConsumerRegistry.clear();
  });

  it('rewrites the bare subject into a consumer-scoped pattern', () => {
    @NatsController({ consumer: 'storage.file' })
    class Controller {
      @EventPattern('auth-user-create')
      onUserCreate(): void {}
    }

    expect(getPatterns(Controller, 'onUserCreate')).toEqual(['auth-user-create@storage.file']);
  });

  it('gives two controllers on the same subject independent patterns and durables', () => {
    @NatsController({ consumer: 'storage.file' })
    class FileController {
      @EventPattern('auth-user-create')
      onUserCreate(): void {}
    }

    @NatsController({ consumer: 'storage.storage-object' })
    class StorageObjectController {
      @EventPattern('auth-user-create')
      onUserCreate(): void {}
    }

    expect(getPatterns(FileController, 'onUserCreate')).toEqual(['auth-user-create@storage.file']);
    expect(getPatterns(StorageObjectController, 'onUserCreate')).toEqual([
      'auth-user-create@storage.storage-object',
    ]);

    // The regression this adapter exists for: one durable per subscriber, so JetStream fans
    // the event out instead of load-balancing it across a single shared consumer.
    expect(globalConsumerRegistry.getSubscriptions().map((item) => item.durable)).toEqual([
      'storage-file-auth-user-create',
      'storage-storage-object-auth-user-create',
    ]);
  });

  it('keeps an already rewritten pattern untouched', () => {
    const Decorate = NatsController({ consumer: 'storage.file' });

    class Controller {
      @EventPattern('auth-user-create')
      onUserCreate(): void {}
    }

    Decorate(Controller);
    Decorate(Controller);

    expect(getPatterns(Controller, 'onUserCreate')).toEqual(['auth-user-create@storage.file']);
  });

  it('rejects a consumer id that is not lowercase dot/dash segments', () => {
    expect(() => {
      @NatsController({ consumer: 'Storage File' })
      class Controller {
        @EventPattern('auth-user-create')
        onUserCreate(): void {}
      }

      return Controller;
    }).toThrow('Invalid NATS event-bus consumer id');
  });
});
