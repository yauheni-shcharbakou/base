import { dotCase } from 'change-case-all';
import { readFile } from 'fs/promises';
import { PROTO_SRC_ROOT, TS_EXT_REG_EXP } from './helpers/constants';
import { join } from 'path';
import * as protobuf from 'protobufjs';

export type ServiceData = {
  id: string;
  name: string;
};

export type ContextData = {
  services: ServiceData[];
  packageId?: string;
  protoPath: string;
};

export class Context {
  private readonly dataByPath = new Map<string, ContextData>();

  protected async parseProtoFile(relativePath: string): Promise<ContextData> {
    const path = relativePath.replace(TS_EXT_REG_EXP, '.proto');
    const protoFilePath = join(PROTO_SRC_ROOT, path);
    const services = new Map<string, ServiceData>();

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

  async createData(relativePath: string): Promise<void> {
    if (!this.dataByPath.has(relativePath)) {
      this.dataByPath.set(relativePath, await this.parseProtoFile(relativePath));
    }
  }

  getData(relativePath: string): ContextData {
    return this.dataByPath.get(relativePath);
  }
}
