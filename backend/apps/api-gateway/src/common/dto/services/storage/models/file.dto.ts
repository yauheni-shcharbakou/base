import { GrpcFile, GrpcFileMetadata, GrpcFileUploadStatus } from '@backend/grpc';
import { ApiProperty, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { EntityWithTimestampsDto } from 'common/dto/entity-with-timestamps.dto';

export class FileDto extends EntityWithTimestampsDto implements GrpcFile {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  mimeType: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  originalName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  size: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({ enum: GrpcFileUploadStatus, enumName: 'GrpcFileUploadStatus' })
  @IsNotEmpty()
  @IsEnum(GrpcFileUploadStatus)
  uploadStatus: GrpcFileUploadStatus;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  extension: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  providerId?: string;
}

export class FileMetadataDto
  extends PickType(FileDto, ['originalName', 'size', 'mimeType'] as const)
  implements GrpcFileMetadata {}
