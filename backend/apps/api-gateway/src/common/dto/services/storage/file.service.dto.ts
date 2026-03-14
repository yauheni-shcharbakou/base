import {
  GrpcFileCreateRequest,
  GrpcFileQuery,
  GrpcFileRequest,
  GrpcFileUploadStatus,
} from '@backend/grpc';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TransformToArray } from 'common/decorators/transform.decorator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import { RequestDto } from 'common/dto/grpc-types.dto';
import { FileMetadataDto } from 'common/dto/services/storage/models/file.dto';
import { StorageObjectMetadataDto } from 'common/dto/services/storage/models/storage-object.dto';

export class FileQueryDto extends BaseQueryDto implements GrpcFileQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  @TransformToArray()
  mimeTypes: string[] = [];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  @TransformToArray()
  userIds: string[] = [];

  @ApiProperty({ required: false, enum: GrpcFileUploadStatus, enumName: 'GrpcFileUploadStatus' })
  @IsOptional()
  @IsEnum(GrpcFileUploadStatus)
  uploadStatus?: GrpcFileUploadStatus;

  @ApiProperty({
    required: false,
    enum: GrpcFileUploadStatus,
    enumName: 'GrpcFileUploadStatus',
    isArray: true,
  })
  @IsOptional()
  @IsEnum(GrpcFileUploadStatus, { each: true })
  @TransformToArray()
  uploadStatuses: GrpcFileUploadStatus[] = [];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  extension?: string;
}

export class FileRequestDto extends RequestDto(FileQueryDto) implements GrpcFileRequest {}

export class FileCreateRequestDto implements GrpcFileCreateRequest {
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
