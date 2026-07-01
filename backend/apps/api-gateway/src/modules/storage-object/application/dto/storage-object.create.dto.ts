import { NestStorage } from '@backend/proto';
import { EnumField, ULIDField } from '@common/application/decorators/field.decorator.dto';
import { StorageMetaDto } from '@common/application/dto/storage/storage-meta.dto';
import { OmitType } from '@nestjs/swagger';

export class StorageObjectCreateDto
  extends StorageMetaDto
  implements NestStorage.StorageObjectCreate
{
  @EnumField(NestStorage.StorageObjectType, { enumName: 'StorageObjectType' })
  type: NestStorage.StorageObjectType;

  @ULIDField()
  userId: string;

  @ULIDField({ required: false })
  file?: string;

  @ULIDField({ required: false })
  image?: string;

  @ULIDField({ required: false })
  video?: string;
}

export class StorageObjectCreateWebDto
  extends OmitType(StorageObjectCreateDto, ['userId'] as const)
  implements NestStorage.StorageObjectCreateWeb {}
