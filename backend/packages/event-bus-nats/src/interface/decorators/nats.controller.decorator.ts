import 'reflect-metadata';
import { applyDecorators, Controller, UseInterceptors } from '@nestjs/common';
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import {
  assertConsumerId,
  buildConsumerPattern,
  buildDurableName,
  globalConsumerRegistry,
  isConsumerPattern,
} from '@/infrastructure';
import { NatsControllerInterceptor } from '../interceptors';

type NatsControllerParams = {
  /** Identifies this controller across the whole system, e.g. `storage.file`. */
  consumer: string;
  /** Overrides `NATS_CONSUMER_CONCURRENCY` (`max_ack_pending`) for this controller. */
  concurrency?: number;
};

/**
 * Binds every event subject declared on the class to this controller's own JetStream durable
 * consumer, and registers the subscriptions the way `globalStreamRegistry` registers streams.
 *
 * Without it, two controllers of the same host subscribed to one subject would collide: Nest
 * keys `messageHandlers` by pattern, so the second registration would replace the first, and
 * both would end up behind a single durable that load-balances instead of fanning out.
 *
 * Method decorators (`ControllerMethods()` / `@NatsEvent`) run before class decorators, so
 * they can only store the bare subject. This decorator runs last (class decorators apply
 * bottom-up, so keep `@NatsController()` above the transport decorator) and rewrites
 * `PATTERN_METADATA` into `<subject>@<consumerId>`. That suffix is a process-local map key
 * only — the server strategy strips it before talking to NATS.
 */
export const NatsController = (params: NatsControllerParams): ClassDecorator => {
  return applyDecorators(
    bindConsumerPatterns(params),
    Controller(),
    UseInterceptors(NatsControllerInterceptor),
  );
};

const bindConsumerPatterns = (params: NatsControllerParams): ClassDecorator => {
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

      const consumerPatterns = patterns.map((pattern): string => {
        const subject = String(pattern);

        // Already rewritten (decorator applied twice) — keep the pattern as it is.
        if (isConsumerPattern(subject)) {
          return subject;
        }

        const consumerPattern = buildConsumerPattern(subject, params.consumer);

        globalConsumerRegistry.append({
          subject,
          pattern: consumerPattern,
          consumerId: params.consumer,
          durable: buildDurableName(subject, params.consumer),
          concurrency: params.concurrency,
        });

        return consumerPattern;
      });

      Reflect.defineMetadata(PATTERN_METADATA, consumerPatterns, descriptor.value);
    }
  };
};
