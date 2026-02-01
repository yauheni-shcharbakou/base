import { pascalCase } from 'change-case-all';
import * as _ from 'lodash';
import { BaseTransformer } from '../base.transformer';

export class JsFixExportsTransformer extends BaseTransformer {
  transform(): void {
    const unexportActors: string[] = ['MessageFns', 'Exact', 'DeepPartial'];

    _.forEach(this.contextData.services, ({ name }) => {
      const serviceClientName = pascalCase(`${name}.client`);
      const serviceClientNameWithPrefix = pascalCase(`grpc.${serviceClientName}`);

      unexportActors.push(pascalCase(`${name}.server`), pascalCase(`${name}.service`));

      this.sourceFile.getInterface(serviceClientName)?.rename(serviceClientNameWithPrefix);

      this.sourceFile
        .getVariableDeclaration(serviceClientName)
        ?.rename(serviceClientNameWithPrefix);
    });

    _.forEach(unexportActors, (name) => {
      this.getVariableStatement(name)?.setIsExported(false);
      this.sourceFile.getInterface(name)?.setIsExported(false);
      this.sourceFile.getTypeAlias(name)?.setIsExported(false);
    });
  }
}
