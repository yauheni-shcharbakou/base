import { beforeAll, describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RpcParamtype } from '@nestjs/microservices/enums/rpc-paramtype.enum';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MODULES = join(__dirname, '../../../modules');

// Where the key of a `@Payload()` on a handler's first parameter sits in its argument metadata.
const PAYLOAD_KEY = `${RpcParamtype.PAYLOAD}:0`;

interface Handler {
  name: string;
  args: Record<string, unknown>;
}

const controllerPaths = (): string[] =>
  readdirSync(MODULES).flatMap((module) => {
    const dir = join(MODULES, module, 'interface', 'grpc');

    return existsSync(dir)
      ? readdirSync(dir)
          .filter((file) => file.endsWith('.controller.ts'))
          .map((file) => join(dir, file))
      : [];
  });

/**
 * Nest hands a gRPC handler its request, metadata and call only while none of its parameters is
 * decorated. Once one is — `@GrpcUserId()` — it fills the decorated slots alone and passes
 * `undefined` for every other one, so a request not bound with `@Payload()` never arrives, and the
 * `@ValidateGrpcPayload` pipe never sees it. Nothing fails loudly: the handler just reads nothing.
 */
describe('gRPC controller handlers', () => {
  const handlers: Handler[] = [];

  // The first import of every controller also transforms its whole graph (Nest, `@backend/proto`)
  // through swc, which on a CI runner busy with the rest of the turbo run took past the default
  // 10 s. The spec cannot import them statically: `import.meta.glob` is ESM, and this app is CJS.
  beforeAll(async () => {
    for (const path of controllerPaths()) {
      const exported: Record<string, unknown> = await import(path);

      for (const controller of Object.values(exported)) {
        if (typeof controller !== 'function' || !controller.prototype) {
          continue;
        }

        for (const method of Object.getOwnPropertyNames(controller.prototype)) {
          if (method !== 'constructor') {
            handlers.push({
              name: `${controller.name}.${method}`,
              args: Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) ?? {},
            });
          }
        }
      }
    }
  }, 60_000);

  // A moved directory would otherwise leave the check below passing over nothing.
  it('are found', () => {
    expect(handlers.length).toBeGreaterThan(0);
  });

  it('bind their request with @Payload() whenever they decorate a parameter', () => {
    const unbound = handlers
      .filter(({ args }) => Object.keys(args).length > 0 && !(PAYLOAD_KEY in args))
      .map(({ name }) => name);

    expect(unbound).toEqual([]);
  });
});
