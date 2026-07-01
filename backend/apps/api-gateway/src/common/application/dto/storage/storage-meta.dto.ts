import { NestStorage } from '@backend/proto';
import {
  BooleanField,
  StringField,
  ULIDField,
} from '@common/application/decorators/field.decorator.dto';
import { OmitType } from '@nestjs/swagger';

export class StorageMetaDto implements NestStorage.StorageMeta {
  @StringField()
  name: string;

  @BooleanField()
  isPublic: boolean;

  @ULIDField()
  parent: string;
}

export class StorageManyMetaDto
  extends OmitType(StorageMetaDto, ['name'] as const)
  implements NestStorage.StorageManyMeta {}
