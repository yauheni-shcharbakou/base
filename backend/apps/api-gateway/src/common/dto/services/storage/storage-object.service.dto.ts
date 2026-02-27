import {
  GrpcStorageObject,
  GrpcStorageObjectType,
  GrpcStorageObjectPopulated,
  GrpcStorageObjectQuery,
  GrpcStorageObjectRequest,
  GrpcStorageObjectCreate,
  GrpcStorageObjectMetadata,
  GrpcStorageObjectUpdate,
  GrpcStorageObjectUpdateByIdRequest,
  GrpcStorageObjectUpdateRequest,
} from '@backend/grpc';
import { ApiProperty, OmitType, PickType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TransformToBoolean } from 'common/decorators/transform.decorator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import { EntityWithTimestampsDto } from 'common/dto/entity-with-timestamps.dto';
import {
  RequestDto,
  UpdateByIdRequestDto,
  UpdateDto,
  UpdateRequestDto,
} from 'common/dto/grpc-types.dto';

export class StorageObjectDto extends EntityWithTimestampsDto implements GrpcStorageObject {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  file?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  folderPath?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  @TransformToBoolean()
  isPublic: boolean;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parent?: string;

  @ApiProperty({ enum: GrpcStorageObjectType, enumName: 'GrpcStorageObjectType' })
  @IsNotEmpty()
  @IsEnum(GrpcStorageObjectType)
  type: GrpcStorageObjectType;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  user: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  video?: string;
}

export class StorageObjectPopulatedDto
  extends OmitType(StorageObjectDto, ['file', 'image', 'video'] as const)
  implements GrpcStorageObjectPopulated {}

export class StorageObjectQueryDto extends BaseQueryDto implements GrpcStorageObjectQuery {
  @ApiProperty({ required: false, enum: GrpcStorageObjectType, enumName: 'GrpcStorageObjectType' })
  @IsOptional()
  @IsEnum(GrpcStorageObjectType)
  type?: GrpcStorageObjectType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @TransformToBoolean()
  isPublic?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parent?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  file?: string;
}

export class StorageObjectRequestDto
  extends RequestDto(StorageObjectQueryDto)
  implements GrpcStorageObjectRequest {}

export class StorageObjectCreateDto
  extends PickType(StorageObjectDto, [
    'name',
    'isPublic',
    'type',
    'file',
    'image',
    'video',
  ] as const)
  implements GrpcStorageObjectCreate
{
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  parent: string;
}

export class StorageObjectMetadataDto
  extends PickType(StorageObjectCreateDto, ['name', 'isPublic', 'parent', 'type'] as const)
  implements GrpcStorageObjectMetadata {}

export class StorageObjectUpdateDto
  extends UpdateDto(StorageObjectDto)
  implements GrpcStorageObjectUpdate {}

export class StorageObjectUpdateRequestDto
  extends UpdateRequestDto(StorageObjectQueryDto, StorageObjectUpdateDto)
  implements GrpcStorageObjectUpdateRequest {}

export class StorageObjectUpdateByIdRequestDto
  extends UpdateByIdRequestDto(StorageObjectUpdateDto)
  implements GrpcStorageObjectUpdateByIdRequest {}
