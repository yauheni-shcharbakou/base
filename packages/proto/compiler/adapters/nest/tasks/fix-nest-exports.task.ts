import { constantCase, pascalCase } from 'change-case-all';
import { TransformTask } from 'compiler/tasks';

export class FixNestExportsTask extends TransformTask {
  canTransform(): boolean | Promise<boolean> {
    return !!(this.protoContext.services.length || this.protoContext.packageId);
  }

  transform(): void {
    this.protoContext.services.forEach(({ name }) => {
      const serviceClientName = pascalCase(`${name}.client`);
      const serviceClientNameWithPrefix = pascalCase(`grpc.${serviceClientName}`);

      const serviceControllerName = pascalCase(`${name}.controller`);
      const serviceControllerNameWithPrefix = pascalCase(`grpc.${serviceControllerName}`);

      this.sourceFile.getInterface(serviceClientName)?.rename(serviceClientNameWithPrefix);
      this.sourceFile.getInterface(serviceControllerName)?.rename(serviceControllerNameWithPrefix);

      this.sourceFile.getFunction(pascalCase(`${name}.controller.methods`))?.setIsExported(false);
      this.sourceFile.getVariableStatement(constantCase(`${name}.name`))?.setIsExported(false);
    });

    if (this.protoContext.packageId) {
      const packageConstName = constantCase(`${this.protoContext.packageId}.package.name`);
      this.getVariableStatement(packageConstName)?.setIsExported(false);
    }
  }
}
