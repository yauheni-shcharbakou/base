import { Type, UsePipes, ValidationPipe } from '@nestjs/common';

export const ValidateGrpcPayload = (Dto: Type): MethodDecorator => {
  return UsePipes(new ValidationPipe({ transform: true, expectedType: Dto }));
};
