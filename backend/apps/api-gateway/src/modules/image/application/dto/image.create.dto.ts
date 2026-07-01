import { NestStorage } from '@backend/proto';
import {
  NumberField,
  ObjectField,
  StringField,
  ULIDField,
} from '@common/application/decorators/field.decorator.dto';
import { StorageMetaDto } from '@common/application/dto/storage/storage-meta.dto';
import { FileCreateDto } from '@modules/file/application/dto/file.create.dto';
import { OmitType } from '@nestjs/swagger';
import { IsPositive } from 'class-validator';

export class ImageCreateDto implements NestStorage.ImageCreate {
  @NumberField()
  @IsPositive()
  width: number;

  @NumberField()
  @IsPositive()
  height: number;

  @StringField()
  alt: string;
}

export class ImageCreateOneDto implements NestStorage.ImageCreateOne {
  @ObjectField(ImageCreateDto)
  image: ImageCreateDto;

  @ObjectField(FileCreateDto)
  file: FileCreateDto;

  @ObjectField(StorageMetaDto, { required: false })
  storage?: StorageMetaDto;

  @ULIDField()
  userId: string;
}

export class ImageCreateOneWebDto
  extends OmitType(ImageCreateOneDto, ['userId'] as const)
  implements NestStorage.ImageCreateOneWeb {}
