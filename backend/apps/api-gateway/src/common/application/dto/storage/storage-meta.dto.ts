import { NestStorage } from '@backend/proto';
import {
  BooleanField,
  StringField,
  ULIDField,
} from '@common/application/decorators/field.decorator.dto';
import { OmitType } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * A storage-object name: not empty and free of '/'. The storage service joins folder names with '/'
 * into `folderPath`, so a name holding one would read as two levels — its database refuses such a
 * row, and this turns the refusal into a 400 instead of a failed write.
 */
export const IsStorageObjectName = () =>
  Matches(/^[^/]+$/, { message: '$property must not be empty or contain "/"' });

export class StorageMetaDto implements NestStorage.StorageMeta {
  @StringField()
  @IsStorageObjectName()
  name: string;

  @BooleanField()
  isPublic: boolean;

  @ULIDField()
  parent: string;
}

export class StorageManyMetaDto
  extends OmitType(StorageMetaDto, ['name'] as const)
  implements NestStorage.StorageManyMeta {}
