import 'reflect-metadata';
import { applyDecorators, Controller, UseInterceptors } from '@nestjs/common';
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import {
  assertConsumerId,
  buildConsumerQueueName,
  globalQueueRegistry,
  isConsumerQueueName,
} from '@/infrastructure';
import { RedisControllerInterceptor } from '../interceptors';

type RedisControllerParams = {
  /** Identifies this controller across the whole system, e.g. `storage.file`. */
  consumer: string;
  /** Overrides `REDIS_WORKER_CONCURRENCY` for the workers of this controller. */
  concurrency?: number;
};

/**
 * Binds every event pattern declared on the class to this controller's own queues and
 * registers the subscriptions, the way `NatsXTransport.ControllerMethods()` registers
 * JetStream streams.
 *
 * Method decorators (`ControllerMethods()` / `@RedisEvent`) run before class decorators,
 * so they can only store the bare event id. This decorator runs last (class decorators
 * apply bottom-up, so keep `@RedisController()` above `ControllerMethods()`) and rewrites
 * `PATTERN_METADATA` into `<eventId>@<consumerId>` — the actual BullMQ queue name.
 */
export const RedisController = (params: RedisControllerParams): ClassDecorator => {
  return applyDecorators(
    bindConsumerQueues(params),
    Controller(),
    UseInterceptors(RedisControllerInterceptor),
  );
};

const bindConsumerQueues = (params: RedisControllerParams): ClassDecorator => {
  return (target) => {
    assertConsumerId(params.consumer);

    const prototype = target.prototype as Record<string, unknown>;

    for (const propertyName of Object.getOwnPropertyNames(prototype)) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);

      if (!descriptor || typeof descriptor.value !== 'function') {
        continue;
      }

      const patterns: unknown = Reflect.getMetadata(PATTERN_METADATA, descriptor.value);

      if (!Array.isArray(patterns) || !patterns.length) {
        continue;
      }

      const queueNames = patterns.map((pattern): string => {
        const eventId = String(pattern);

        // Already rewritten (decorator applied twice) — keep the queue name as it is.
        if (isConsumerQueueName(eventId)) {
          return eventId;
        }

        const queueName = buildConsumerQueueName(eventId, params.consumer);

        globalQueueRegistry.append({
          eventId,
          queueName,
          consumerId: params.consumer,
          concurrency: params.concurrency,
        });

        return queueName;
      });

      Reflect.defineMetadata(PATTERN_METADATA, queueNames, descriptor.value);
    }
  };
};
