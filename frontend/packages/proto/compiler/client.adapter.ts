import {
  BaseAdapter,
  getProtocPluginPath,
  OnFilePayload,
  runProtoc,
} from '@packages/proto/compiler';
import { join } from 'node:path';
import { SourceFile } from 'ts-morph';

export class ClientAdapter extends BaseAdapter {
  protected addSideEffects(sourceFile: SourceFile): void | Promise<void> {
    sourceFile.insertText(0, '// @ts-nocheck\n');
  }

  async onFile(payload: OnFilePayload): Promise<void> {
    await runProtoc(payload.relativePath, {
      pluginPath: getProtocPluginPath(join(__dirname, '..')),
      outDir: this.targetRoot,
      options: [
        'useDate=true',
        'snakeToCamel=false',
        'useMapType=true',
        'unrecognizedEnum=false',
        'stringEnums=true',
        'addGrpcMetadata=true',
        'outputServices=grpc-js',
      ],
    });

    await super.onFile(payload);
  }
}
