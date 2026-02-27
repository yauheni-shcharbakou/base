import { GrpcIdField } from '@backend/grpc';
import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class IdFieldDto implements GrpcIdField {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  // @IsMongoId()
  id: string;
}
