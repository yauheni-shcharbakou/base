import { GrpcIdField } from '@backend/grpc';
import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class IdFieldDto implements GrpcIdField {
  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  id: string;
}
