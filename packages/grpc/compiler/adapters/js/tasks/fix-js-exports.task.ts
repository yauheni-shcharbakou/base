import { pascalCase } from 'change-case-all';
import { TransformTask } from 'compiler/tasks';

export class FixJsExportsTask extends TransformTask {
  transform(): void {
    const unexportActors: string[] = ['MessageFns', 'Exact', 'DeepPartial'];

    this.protoContext.services.forEach(({ name }) => {
      const serviceClientName = pascalCase(`${name}.client`);
      const serviceClientNameWithPrefix = pascalCase(`grpc.${serviceClientName}`);

      unexportActors.push(pascalCase(`${name}.server`), pascalCase(`${name}.service`));

      this.sourceFile.getInterface(serviceClientName)?.rename(serviceClientNameWithPrefix);

      this.sourceFile
        .getVariableDeclaration(serviceClientName)
        ?.rename(serviceClientNameWithPrefix);
    });

    unexportActors.forEach((name) => {
      this.getVariableStatement(name)?.setIsExported(false);
      this.sourceFile.getInterface(name)?.setIsExported(false);
      this.sourceFile.getTypeAlias(name)?.setIsExported(false);
    });
  }
}
