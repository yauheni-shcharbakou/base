import { constantCase, pascalCase } from 'change-case-all';
import { BaseTransformer } from '../base.transformer';

export class NestFixExportsTransformer extends BaseTransformer {
  canTransform(): boolean | Promise<boolean> {
    return !!(this.contextData.services.length || this.contextData.packageId);
  }

  transform(): void {
    this.contextData.services.forEach(({ name }) => {
      const serviceClientName = pascalCase(`${name}.client`);
      const serviceClientNameWithPrefix = pascalCase(`grpc.${serviceClientName}`);

      const serviceControllerName = pascalCase(`${name}.controller`);
      const serviceControllerNameWithPrefix = pascalCase(`grpc.${serviceControllerName}`);

      this.sourceFile.getInterface(serviceClientName)?.rename(serviceClientNameWithPrefix);
      this.sourceFile.getInterface(serviceControllerName)?.rename(serviceControllerNameWithPrefix);

      this.sourceFile.getFunction(pascalCase(`${name}.controller.methods`))?.setIsExported(false);
      this.sourceFile.getVariableStatement(constantCase(`${name}.name`))?.setIsExported(false);
    });

    if (this.contextData.packageId) {
      const packageConstName = constantCase(`${this.contextData.packageId}.package.name`);
      this.getVariableStatement(packageConstName)?.setIsExported(false);
    }
  }
}
