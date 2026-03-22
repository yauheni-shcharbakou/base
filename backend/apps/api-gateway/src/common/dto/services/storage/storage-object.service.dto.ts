import {
  GrpcStorageObjectType,
  GrpcStorageObjectQuery,
  GrpcStorageObjectRequest,
  GrpcStorageObjectCreate,
  GrpcStorageObjectUpdate,
  GrpcStorageObjectUpdateByIdRequest,
  GrpcStorageObjectUpdateRequest,
  GrpcStorageObjectExistsFolderRequest,
} from '@backend/grpc';
import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TransformToBoolean } from 'common/decorators/transform.decorator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import {
  RequestDto,
  UpdateByIdRequestDto,
  UpdateDto,
  UpdateRequestDto,
} from 'common/dto/grpc-types.dto';
import { StorageObjectDto } from 'common/dto/services/storage/models/storage-object.dto';

export class StorageObjectQueryDto extends BaseQueryDto implements GrpcStorageObjectQuery {
  @ApiProperty({ required: false, enum: GrpcStorageObjectType, enumName: 'GrpcStorageObjectType' })
  @IsOptional()
  @IsEnum(GrpcStorageObjectType)
  type?: GrpcStorageObjectType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

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

export class StorageObjectExistsFolderRequestDto
  extends PickType(StorageObjectDto, ['name'] as const)
  implements GrpcStorageObjectExistsFolderRequest
{
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  parent: string;
}

export class StorageObjectCreateDto
  extends PickType(StorageObjectDto, ['type', 'name', 'isPublic'] as const)
  implements GrpcStorageObjectCreate
{
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parent?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  file?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  video?: string;
}

export class StorageObjectUpdateDto
  extends UpdateDto(StorageObjectDto)
  implements GrpcStorageObjectUpdate {}

export class StorageObjectUpdateRequestDto
  extends UpdateRequestDto(StorageObjectQueryDto, StorageObjectUpdateDto)
  implements GrpcStorageObjectUpdateRequest {}

export class StorageObjectUpdateByIdRequestDto
  extends UpdateByIdRequestDto(StorageObjectUpdateDto)
  implements GrpcStorageObjectUpdateByIdRequest {}
