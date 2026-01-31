import { Type } from '@nestjs/common';
import { JsRepositoryTransformer } from './js/js.repository.transformer';
import { JsRemoveDuplicateExportsTransformer } from './js/js.remove-duplicate-exports.transformer';
import { RemoveOptionalityTransformer } from './remove-optionality.transformer';
import { CommonTransformer } from './common.transformer';
import { BaseTransformer } from './base.transformer';
import { NestProxyControllerTransformer } from './nest/nest.proxy-controller.transformer';

export const jsTransformers: Type<BaseTransformer>[] = [
  CommonTransformer,
  JsRemoveDuplicateExportsTransformer,
  JsRepositoryTransformer,
];

export const nestTransformers: Type<BaseTransformer>[] = [
  CommonTransformer,
  JsRemoveDuplicateExportsTransformer,
  RemoveOptionalityTransformer,
  NestProxyControllerTransformer,
];
