import { NestStorage } from '@backend/proto';
import { ULIDField } from '@common/application/decorators/field.decorator.dto';
import { OmitType } from '@nestjs/swagger';

export class StorageObjectGetFoldersDto implements NestStorage.StorageObjectGetFolders {
  @ULIDField({ required: false })
  excludeChildrenOf?: string;

  @ULIDField()
  userId: string;
}

export class StorageObjectGetFoldersWebDto
  extends OmitType(StorageObjectGetFoldersDto, ['userId'] as const)
  implements NestStorage.StorageObjectGetFoldersWeb {}
