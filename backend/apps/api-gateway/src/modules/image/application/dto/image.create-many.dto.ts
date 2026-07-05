import { NestStorage } from '@backend/proto';
import {
  ObjectField,
  StringField,
  ULIDField,
} from '@common/application/decorators/field.decorator.dto';
import { StorageManyMetaDto } from '@common/application/dto/storage/storage-meta.dto';
import { FileCreateDto } from '@modules/file/application/dto/file.create.dto';
import { OmitType } from '@nestjs/swagger';
import { ImageCreateDto } from './image.create.dto';

class ImageCreateManyItemDto implements NestStorage.ImageCreateManyItem {
  @ObjectField(ImageCreateDto)
  image: ImageCreateDto;

  @ObjectField(FileCreateDto)
  file: FileCreateDto;

  @StringField()
  uploadId: string;
}

export class ImageCreateManyDto implements NestStorage.ImageCreateMany {
  @ObjectField(StorageManyMetaDto, { required: false })
  storage?: StorageManyMetaDto;

  @ObjectField(ImageCreateManyItemDto, { isArray: true })
  items: ImageCreateManyItemDto[];

  @ULIDField()
  userId: string;
}

export class ImageCreateManyWebDto
  extends OmitType(ImageCreateManyDto, ['userId'] as const)
  implements NestStorage.ImageCreateManyWeb {}
