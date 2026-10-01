import { NestStorage } from '@backend/proto';
import { ObjectField, ULIDField } from '@common/application/decorators/field.decorator.dto';
import { MAX_BATCH_SIZE } from '@common/application/dto/ids-field.dto';
import { StorageManyMetaDto } from '@common/application/dto/storage/storage-meta.dto';
import { OmitType } from '@nestjs/swagger';
import { ArrayMaxSize } from 'class-validator';
import { FileCreateDto } from './file.create.dto';

export class FileCreateManyDto implements NestStorage.FileCreateMany {
  @ObjectField(StorageManyMetaDto, { required: false })
  storage?: StorageManyMetaDto;

  @ObjectField(FileCreateDto, { isArray: true })
  @ArrayMaxSize(MAX_BATCH_SIZE)
  items: FileCreateDto[];

  @ULIDField()
  userId: string;
}

export class FileCreateManyWebDto
  extends OmitType(FileCreateManyDto, ['userId'] as const)
  implements NestStorage.FileCreateManyWeb {}
