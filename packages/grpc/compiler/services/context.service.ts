import { dotCase } from 'change-case-all';
import { PROTO_EXT_REG_EXP, PROTO_SRC_ROOT, TS_EXT_REG_EXP } from 'compiler/constants';
import { ExecutionContext, ProtoContext, ProtoContextService } from 'compiler/types';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as protobuf from 'protobufjs';
import zod from 'zod';

export class ContextService {
  private readonly protoContextByPath = new Map<string, ProtoContext>();

  private readonly env = zod
    .object({ GRPC_COMPILER_CONTEXT: zod.enum(['backend', 'frontend', 'all']).default('all') })
    .parse(process.env);

  private readonly files = new Set<string>();
  private readonly entrypointExports = new Set<string>();

  protected getIdFromPath(relativePath: string): string {
    return relativePath.replace(PROTO_EXT_REG_EXP, '').replace(TS_EXT_REG_EXP, '');
  }

  protected async parseProtoFile(relativePath: string): Promise<ProtoContext> {
    const path = relativePath.replace(TS_EXT_REG_EXP, '.proto');
    const protoFilePath = join(PROTO_SRC_ROOT, path);
    const services = new Map<string, ProtoContextService>();

    try {
      const protoContent = await readFile(protoFilePath, { encoding: 'utf-8' });
      const parsedContent = protobuf.parse(protoContent);

      const findServices = (obj: any) => {
        if (obj.methods) {
          const name = dotCase(obj.name);
          const id = name.replace('.service', '');

          services.set(id, { id, name });
        }

        if (obj.nested) {
          Object.values(obj.nested).forEach(findServices);
        }
      };

      findServices(
        parsedContent.package
          ? parsedContent.root.lookup(parsedContent.package)
          : parsedContent.root,
      );

      return {
        services: Array.from(services.values()),
        packageId: parsedContent.package ? dotCase(parsedContent.package) : undefined,
        protoPath: path,
      };
    } catch (error) {
      return {
        services: [],
        protoPath: path,
      };
    }
  }

  async parseProto(relativePaths: string[]): Promise<void> {
    await Promise.all(
      relativePaths.map(async (relativePath) => {
        const context = await this.parseProtoFile(relativePath);
        this.protoContextByPath.set(this.getIdFromPath(relativePath), context);
      }),
    );
  }

  addFile(relativePath: string) {
    this.files.add(relativePath);
  }

  addEntrypointExport(importName: string) {
    this.entrypointExports.add(importName);
  }

  getProtoContext(relativePath: string): ProtoContext {
    const protoContext = this.protoContextByPath.get(this.getIdFromPath(relativePath));

    if (!protoContext) {
      return { services: [] };
    }

    return protoContext;
  }

  getExecutionContext(): ExecutionContext {
    return {
      compiler: this.env.GRPC_COMPILER_CONTEXT,
      files: Array.from(this.files),
      entrypointExports: Array.from(this.entrypointExports),
    };
  }
}
