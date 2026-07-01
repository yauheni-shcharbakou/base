import { NestStorage } from '@backend/proto';
import {
  NumberField,
  ObjectField,
  StringField,
  ULIDField,
} from '@common/application/decorators/field.decorator.dto';
import { StorageMetaDto } from '@common/application/dto/storage/storage-meta.dto';
import { OmitType } from '@nestjs/swagger';
import { IsPositive } from 'class-validator';

export class FileCreateDto implements NestStorage.FileCreate {
  @StringField()
  originalName: string;

  @NumberField()
  @IsPositive()
  size: number;

  @StringField()
  mimeType: string;
}

export class FileCreateOneDto implements NestStorage.FileCreateOne {
  @ObjectField(FileCreateDto)
  file: FileCreateDto;

  @ObjectField(StorageMetaDto, { required: false })
  storage?: StorageMetaDto;

  @ULIDField()
  userId: string;
}

export class FileCreateOneWebDto
  extends OmitType(FileCreateOneDto, ['userId'] as const)
  implements NestStorage.FileCreateOneWeb {}
