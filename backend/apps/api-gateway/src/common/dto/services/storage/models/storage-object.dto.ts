import {
  GrpcStorageObject,
  GrpcStorageObjectManyMetadata,
  GrpcStorageObjectMetadata,
  GrpcStorageObjectType,
} from '@backend/grpc';
import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TransformToBoolean } from 'common/decorators/transform.decorator';
import { EntityWithTimestampsDto } from 'common/dto/entity-with-timestamps.dto';

export class StorageObjectDto extends EntityWithTimestampsDto implements GrpcStorageObject {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fileId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  folderPath?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageId?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  @TransformToBoolean()
  isPublic: boolean;

  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  @TransformToBoolean()
  isFolder: boolean;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ enum: GrpcStorageObjectType, enumName: 'GrpcStorageObjectType' })
  @IsNotEmpty()
  @IsEnum(GrpcStorageObjectType)
  type: GrpcStorageObjectType;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  videoId?: string;
}

export class StorageObjectManyMetadataDto
  extends PickType(StorageObjectDto, ['isPublic'] as const)
  implements GrpcStorageObjectManyMetadata
{
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  parent: string;
}

export class StorageObjectMetadataDto
  extends IntersectionType(
    StorageObjectManyMetadataDto,
    PickType(StorageObjectDto, ['name'] as const),
  )
  implements GrpcStorageObjectMetadata {}
