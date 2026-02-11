import { GrpcRxPipe, InjectGrpcService } from '@backend/transport';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GrpcAuthServiceClient, GrpcAuthService } from '@backend/grpc';
import { plainToInstance } from 'class-transformer';
import { Method } from 'common/decorators/method.decorator';
import { AuthLoginDto, AuthTokensDto } from 'common/dto/services/auth.service.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthWebController {
  constructor(
    @InjectGrpcService(GrpcAuthService.name)
    private readonly authServiceClient: GrpcAuthServiceClient,
  ) {}

  @Post('login')
  @Method({ type: AuthTokensDto })
  login(@Body() body: AuthLoginDto) {
    return this.authServiceClient
      .login(body)
      .pipe(GrpcRxPipe.proxy((response) => plainToInstance(AuthTokensDto, response.tokens)));
  }
}
