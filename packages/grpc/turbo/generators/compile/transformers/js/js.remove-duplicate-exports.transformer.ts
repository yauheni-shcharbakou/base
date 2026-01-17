import * as _ from 'lodash';
import { BaseTransformer } from '../base.transformer';

export class JsRemoveDuplicateExportsTransformer extends BaseTransformer {
  transform(): void | Promise<void> {
    _.forEach(['MessageFns', 'Exact', 'DeepPartial'], (name) => {
      const variable = this.sourceFile.getVariableStatement((stmt) => {
        return stmt.getDeclarations().some((decl) => decl.getName() === name);
      });

      const item =
        variable ?? this.sourceFile.getInterface(name) ?? this.sourceFile.getTypeAlias(name);

      item?.setIsExported(false);
    });
  }
}
