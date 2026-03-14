import {
  GrpcImageQuery,
  GrpcImageCreateRequest,
  GrpcImageUpdate,
  GrpcImageUpdateRequest,
  GrpcImageUpdateByIdRequest,
} from '@backend/grpc';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import { UpdateByIdRequestDto, UpdateDto, UpdateRequestDto } from 'common/dto/grpc-types.dto';
import { FileMetadataDto } from 'common/dto/services/storage/models/file.dto';
import { ImageDto, ImageMetadataDto } from 'common/dto/services/storage/models/image.dto';
import { StorageObjectMetadataDto } from 'common/dto/services/storage/models/storage-object.dto';

export class ImageQueryDto extends BaseQueryDto implements GrpcImageQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  file?: string;
}

export class ImageCreateRequestDto implements GrpcImageCreateRequest {
  @ApiProperty({ type: ImageMetadataDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => ImageMetadataDto)
  image: ImageMetadataDto;

  @ApiProperty({ type: FileMetadataDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => FileMetadataDto)
  file: FileMetadataDto;

  @ApiProperty({ required: false, type: StorageObjectMetadataDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StorageObjectMetadataDto)
  storage: StorageObjectMetadataDto;
}

export class ImageUpdateDto extends UpdateDto(ImageDto) implements GrpcImageUpdate {}

export class ImageUpdateRequestDto
  extends UpdateRequestDto(ImageQueryDto, ImageUpdateDto)
  implements GrpcImageUpdateRequest {}

export class ImageUpdateByIdRequestDto
  extends UpdateByIdRequestDto(ImageUpdateDto)
  implements GrpcImageUpdateByIdRequest {}
