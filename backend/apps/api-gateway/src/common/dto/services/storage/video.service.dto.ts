import {
  GrpcVideoQuery,
  GrpcVideoCreateRequest,
  GrpcVideoUpdate,
  GrpcVideoUpdateRequest,
  GrpcVideoUpdateByIdRequest,
} from '@backend/grpc';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { TransformToArray } from 'common/decorators/transform.decorator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import { UpdateByIdRequestDto, UpdateDto, UpdateRequestDto } from 'common/dto/grpc-types.dto';
import { FileMetadataDto } from 'common/dto/services/storage/models/file.dto';
import { StorageObjectMetadataDto } from 'common/dto/services/storage/models/storage-object.dto';
import { VideoDto, VideoMetadataDto } from 'common/dto/services/storage/models/video.dto';

export class VideoQueryDto extends BaseQueryDto implements GrpcVideoQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  file?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  @TransformToArray()
  providerIds: string[] = [];
}

export class VideoCreateRequestDto implements GrpcVideoCreateRequest {
  @ApiProperty({ type: VideoMetadataDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => VideoMetadataDto)
  video: VideoMetadataDto;

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

export class VideoUpdateDto extends UpdateDto(VideoDto) implements GrpcVideoUpdate {}

export class VideoUpdateRequestDto
  extends UpdateRequestDto(VideoQueryDto, VideoUpdateDto)
  implements GrpcVideoUpdateRequest {}

export class VideoUpdateByIdRequestDto
  extends UpdateByIdRequestDto(VideoUpdateDto)
  implements GrpcVideoUpdateByIdRequest {}
