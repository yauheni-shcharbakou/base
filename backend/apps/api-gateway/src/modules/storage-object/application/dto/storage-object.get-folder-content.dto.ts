import { NestCommon, NestStorage } from '@backend/proto';
import {
  BooleanField,
  EnumField,
  ObjectField,
  StringField,
  ULIDField,
} from '@common/application/decorators/field.decorator.dto';
import { PaginationDto } from '@common/application/dto/get-list.dto';
import { OmitType } from '@nestjs/swagger';
import { ArrayMaxSize, MaxLength } from 'class-validator';

class StorageObjectFolderContentQueryDto implements NestStorage.StorageObjectFolderContentQuery {
  @EnumField(NestStorage.StorageObjectType, {
    enumName: 'StorageObjectType',
    required: false,
    isArray: true,
  })
  types: NestStorage.StorageObjectType[] = [];

  @BooleanField({ required: false })
  isPublic?: boolean;

  @StringField({ required: false })
  @MaxLength(255)
  search?: string;
}

class StorageObjectSorterDto implements NestStorage.StorageObjectSorter {
  @EnumField(NestStorage.StorageObjectSortField, { enumName: 'StorageObjectSortField' })
  field: NestStorage.StorageObjectSortField;

  @EnumField(NestCommon.Sort, { enumName: 'Sort' })
  order: NestCommon.Sort;
}

export class StorageObjectGetFolderContentDto implements NestStorage.StorageObjectGetFolderContent {
  @ULIDField()
  parentId: string;

  @ULIDField()
  userId: string;

  @ObjectField(StorageObjectFolderContentQueryDto, { required: false })
  query?: StorageObjectFolderContentQueryDto;

  // One sorter per sortable field; the storage service puts folders ahead of them on its own.
  @ObjectField(StorageObjectSorterDto, { required: false, isArray: true })
  @ArrayMaxSize(4)
  sorters: StorageObjectSorterDto[] = [];

  @ObjectField(PaginationDto, { required: false })
  pagination?: PaginationDto;
}

export class StorageObjectGetFolderContentWebDto
  extends OmitType(StorageObjectGetFolderContentDto, ['userId'] as const)
  implements NestStorage.StorageObjectGetFolderContentWeb {}
