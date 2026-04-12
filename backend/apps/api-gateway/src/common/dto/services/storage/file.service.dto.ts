import {
  GrpcFileCreateManyItem,
  GrpcFileCreateManyRequest,
  GrpcFileCreateRequest,
  GrpcFileQuery,
  GrpcFileRequest,
  GrpcFileUploadStatus,
  GrpcUserRole,
} from '@backend/grpc';
import { ApiProperty, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
import { FileCreateDto } from 'common/dto/services/storage/models/file.dto';
import {
  StorageObjectManyMetadataDto,
  StorageObjectMetadataDto,
} from 'common/dto/services/storage/models/storage-object.dto';

export class FileQueryDto extends BaseQueryDto implements GrpcFileQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  @TransformToArray()
  @ArrayMaxSize(100)
  mimeTypes: string[] = [];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString({ each: true })
  @TransformToArray()
  @ArrayMaxSize(100)
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
  @ArrayMaxSize(Object.keys(GrpcFileUploadStatus).length)
  uploadStatuses: GrpcFileUploadStatus[] = [];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  extension?: string;
}

export class FileRequestDto extends RequestDto(FileQueryDto) implements GrpcFileRequest {}

export class FileCreateRequestDto implements GrpcFileCreateRequest {
  @ApiProperty({ type: FileCreateDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => FileCreateDto)
  file: FileCreateDto;

  @ApiProperty({ type: StorageObjectMetadataDto, required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StorageObjectMetadataDto)
  storage?: StorageObjectMetadataDto;
}

export class FileCreateManyItemDto
  extends PickType(FileCreateRequestDto, ['file'] as const)
  implements GrpcFileCreateManyItem
{
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  uploadId: string;
}

export class FileCreateManyRequestDto implements GrpcFileCreateManyRequest {
  @ApiProperty({ type: [FileCreateManyItemDto] })
  @IsNotEmpty()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => FileCreateManyItemDto)
  @ArrayMaxSize(100)
  items: FileCreateManyItemDto[];

  @ApiProperty({ type: StorageObjectManyMetadataDto, required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StorageObjectManyMetadataDto)
  storage?: StorageObjectManyMetadataDto;
}
