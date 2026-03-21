import { GrpcFileQuery, GrpcFileRequest, GrpcFileUploadStatus } from '@backend/grpc';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TransformToArray } from 'common/decorators/transform.decorator';
import { BaseQueryDto } from 'common/dto/base-query.dto';
import { RequestDto } from 'common/dto/grpc-types.dto';

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
