import { NestStorage } from '@backend/proto';
import {
  ObjectField,
  StringField,
  ULIDField,
} from '@common/application/decorators/field.decorator.dto';
import { StorageManyMetaDto } from '@common/application/dto/storage/storage-meta.dto';
import { OmitType } from '@nestjs/swagger';
import { FileCreateDto } from './file.create.dto';

class FileCreateManyItemDto implements NestStorage.FileCreateManyItem {
  @ObjectField(FileCreateDto)
  file: FileCreateDto;

  @StringField()
  uploadId: string;
}

export class FileCreateManyDto implements NestStorage.FileCreateMany {
  @ObjectField(StorageManyMetaDto, { required: false })
  storage?: StorageManyMetaDto;

  @ObjectField(FileCreateManyItemDto, { isArray: true })
  items: FileCreateManyItemDto[];

  @ULIDField()
  userId: string;
}

export class FileCreateManyWebDto
  extends OmitType(FileCreateManyDto, ['userId'] as const)
  implements NestStorage.FileCreateManyWeb {}
