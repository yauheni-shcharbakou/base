import { BaseAdapter } from '@compiler/adapters/base.adapter';
import { PACKAGE_ROOT } from '@compiler/constants';
import { OnFilePayload } from '@compiler/types';
import { getProtocPluginPath, runProtoc } from '@compiler/utils';

export class BrowserAdapter extends BaseAdapter {
  async onFile(payload: OnFilePayload): Promise<void> {
    await runProtoc(payload.relativePath, {
      pluginPath: getProtocPluginPath(PACKAGE_ROOT),
      outDir: this.targetRoot,
      options: [
        'useDate=true',
        'snakeToCamel=false',
        'unrecognizedEnum=false',
        'stringEnums=true',
        'useMapType=true',
        'onlyTypes=true',
        'outputServices=false',
      ],
    });

    await super.onFile(payload);
  }
}
