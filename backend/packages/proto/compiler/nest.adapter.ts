import {
  BaseAdapter,
  getProtocPluginPath,
  OnFilePayload,
  runProtoc,
} from '@packages/proto/compiler';
import { join } from 'node:path';
import { Project } from 'ts-morph';

export class NestAdapter extends BaseAdapter {
  protected getProject(): Project {
    return new Project({
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    });
  }

  async onFile(payload: OnFilePayload): Promise<void> {
    await runProtoc(payload.relativePath, {
      pluginPath: getProtocPluginPath(join(__dirname, '..')),
      outDir: this.targetRoot,
      options: [
        'nestJs=true',
        'useDate=true',
        'snakeToCamel=false',
        'unrecognizedEnum=false',
        'stringEnums=true',
        'useMapType=false',
        'addGrpcMetadata=true',
        'useSnakeTypeName=false',
      ],
    });

    await super.onFile(payload);
  }
}
