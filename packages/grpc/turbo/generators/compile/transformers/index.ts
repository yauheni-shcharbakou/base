import { Type } from '@nestjs/common';
import { NestFixExportsTransformer } from './nest/nest.fix-exports.transformer';
import { JsRepositoryTransformer } from './js/js.repository.transformer';
import { JsFixExportsTransformer } from './js/js.fix-exports.transformer';
import { RemoveOptionalityTransformer } from './remove-optionality.transformer';
import { CommonTransformer } from './common.transformer';
import { BaseTransformer } from './base.transformer';
import { NestServiceSchemaTransformer } from './nest/nest.service-schema.transformer';

export const typesTransformers: Type<BaseTransformer>[] = [CommonTransformer];

export const jsTransformers: Type<BaseTransformer>[] = [
  CommonTransformer,
  JsFixExportsTransformer,
  JsRepositoryTransformer,
];

export const nestTransformers: Type<BaseTransformer>[] = [
  CommonTransformer,
  RemoveOptionalityTransformer,
  NestFixExportsTransformer,
  NestServiceSchemaTransformer,
];
