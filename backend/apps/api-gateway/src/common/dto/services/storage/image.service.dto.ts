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
import { FileCreateDto } from 'common/dto/services/storage/models/file.dto';
import { ImageDto, ImageCreateDto } from 'common/dto/services/storage/models/image.dto';

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
  @ApiProperty({ type: ImageCreateDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => ImageCreateDto)
  image: ImageCreateDto;

  @ApiProperty({ type: FileCreateDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => FileCreateDto)
  file: FileCreateDto;
}

export class ImageUpdateDto extends UpdateDto(ImageDto) implements GrpcImageUpdate {}

export class ImageUpdateRequestDto
  extends UpdateRequestDto(ImageQueryDto, ImageUpdateDto)
  implements GrpcImageUpdateRequest {}

export class ImageUpdateByIdRequestDto
  extends UpdateByIdRequestDto(ImageUpdateDto)
  implements GrpcImageUpdateByIdRequest {}
