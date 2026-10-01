import 'reflect-metadata';
import { EventPattern } from '@nestjs/microservices';
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { globalQueueRegistry } from '@/infrastructure';
import { RedisController } from './redis.controller.decorator';

const getPatterns = (target: { prototype: object }, method: string): string[] => {
  const descriptor = Object.getOwnPropertyDescriptor(target.prototype, method);
  return Reflect.getMetadata(PATTERN_METADATA, descriptor?.value) ?? [];
};

describe('RedisController', () => {
  beforeEach(() => {
    // The registry is a module singleton shared by every spec, so drop what previous
    // decorators left behind.
    globalQueueRegistry.clear();
  });

  it('rewrites the bare event id into a consumer-scoped queue name', () => {
    @RedisController({ consumer: 'storage.file' })
    class Controller {
      @EventPattern('auth.user.create')
      onUserCreate(): void {}
    }

    expect(getPatterns(Controller, 'onUserCreate')).toEqual(['auth.user.create@storage.file']);
    expect(globalQueueRegistry.getSubscriptions()).toEqual([
      {
        eventId: 'auth.user.create',
        consumerId: 'storage.file',
        queueName: 'auth.user.create@storage.file',
        concurrency: undefined,
      },
    ]);
  });

  it('gives two controllers on the same event independent queues', () => {
    @RedisController({ consumer: 'storage.file' })
    class FileController {
      @EventPattern('auth.user.create')
      onUserCreate(): void {}
    }

    @RedisController({ consumer: 'storage.storage-object' })
    class StorageObjectController {
      @EventPattern('auth.user.create')
      onUserCreate(): void {}
    }

    expect(getPatterns(FileController, 'onUserCreate')).toEqual(['auth.user.create@storage.file']);
    expect(getPatterns(StorageObjectController, 'onUserCreate')).toEqual([
      'auth.user.create@storage.storage-object',
    ]);

    // The regression this adapter exists for: BullMQ hands a job to exactly one worker, so a
    // single shared queue would load-balance the event between the two instead of fanning it out.
    expect(globalQueueRegistry.getQueueNames()).toEqual([
      'auth.user.create@storage.file',
      'auth.user.create@storage.storage-object',
    ]);
  });

  it('registers every event a controller subscribes to', () => {
    @RedisController({ consumer: 'storage.file' })
    class Controller {
      @EventPattern('storage.video.upload.finish')
      onUploadFinish(): void {}

      @EventPattern('storage.video.upload.fail')
      onUploadFail(): void {}
    }

    expect(Controller).toBeDefined();
    expect(globalQueueRegistry.getQueueNames()).toEqual([
      'storage.video.upload.finish@storage.file',
      'storage.video.upload.fail@storage.file',
    ]);
  });

  it('carries the concurrency override into the subscription', () => {
    @RedisController({ consumer: 'storage.file', concurrency: 5 })
    class Controller {
      @EventPattern('auth.user.create')
      onUserCreate(): void {}
    }

    expect(Controller).toBeDefined();
    expect(globalQueueRegistry.getSubscriptions()[0].concurrency).toBe(5);
  });

  it('keeps an already rewritten pattern untouched', () => {
    const Decorate = RedisController({ consumer: 'storage.file' });

    class Controller {
      @EventPattern('auth.user.create')
      onUserCreate(): void {}
    }

    Decorate(Controller);
    Decorate(Controller);

    expect(getPatterns(Controller, 'onUserCreate')).toEqual(['auth.user.create@storage.file']);
    expect(globalQueueRegistry.getSubscriptions()).toHaveLength(1);
  });

  it('rejects a consumer id that is not lowercase dot/dash segments', () => {
    expect(() => {
      @RedisController({ consumer: 'Storage File' })
      class Controller {
        @EventPattern('auth.user.create')
        onUserCreate(): void {}
      }

      return Controller;
    }).toThrow('Invalid Redis event-bus consumer id');
  });

  it('leaves a method without an event pattern alone', () => {
    @RedisController({ consumer: 'storage.file' })
    class Controller {
      helper(): void {}
    }

    expect(getPatterns(Controller, 'helper')).toEqual([]);
    expect(globalQueueRegistry.getSubscriptions()).toHaveLength(0);
  });
});
