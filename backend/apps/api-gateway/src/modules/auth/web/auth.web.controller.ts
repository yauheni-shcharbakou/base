import { Method } from '@backend/common';
import { GrpcRxPipe, InjectGrpcService } from '@backend/transport';
import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AUTH_SERVICE_NAME, AuthServiceClient } from '@packages/grpc.nest';
import { plainToInstance } from 'class-transformer';
import { AuthLoginDto } from 'modules/auth/dto/auth.login.dto';
import { AuthRefreshDto } from 'modules/auth/dto/auth.refresh.dto';
import { AuthTokensDto } from 'modules/auth/dto/auth.tokens.dto';
import { Observable } from 'rxjs';
import { Response, Request } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthWebController {
  constructor(
    @InjectGrpcService(AUTH_SERVICE_NAME)
    private readonly authServiceClient: AuthServiceClient,
  ) {}

  // @Get()
  // @Method({})
  // getUser(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
  //   console.log(req.cookies?.['access-token']);
  //
  //   const userData = {
  //     id: '694ad7594a725e07334adb95',
  //     email: 'user@gmail.com',
  //   };
  //
  //   res
  //     .status(200)
  //     .cookie('access-token-server', '1488', {
  //       httpOnly: true, // защищает от JS
  //       secure: false, // http, не https
  //       sameSite: 'none', // 'lax' кросс-site безопасно на localhost
  //       path: '/', // доступно на всех эндпоинтах
  //       maxAge: 1000 * 60 * 60 * 24, // 1 день
  //     })
  //     .json(userData);
  // }

  @Post('login')
  @Method({ type: AuthTokensDto })
  async login(
    @Body() body: AuthLoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    console.log(req.cookies);
    // console.log(this.authServiceClient.login(body).grpcIn);
    // this.authServiceClient.login(body).grpcIn((res) => res.user).toPromise();

    const result = await this.authServiceClient
      .login(body)
      .pipe(GrpcRxPipe.proxy((response) => plainToInstance(AuthTokensDto, response.tokens)))
      .toPromise();

    res
      // .cookie('access-token-server', '1488', {
      //   httpOnly: true, // защищает от JS
      //   secure: false, // http, не https
      //   sameSite: 'none', // 'lax' кросс-site безопасно на localhost
      //   path: '/', // доступно на всех эндпоинтах
      //   maxAge: 1000 * 60 * 60 * 24, // 1 день
      // })
      .status(200)
      .json(result);
  }

  @Post('refresh-token')
  @Method({ type: AuthTokensDto })
  refreshToken(@Body() body: AuthRefreshDto): Observable<AuthTokensDto> {
    return this.authServiceClient
      .refreshToken(body)
      .pipe(GrpcRxPipe.proxy((response) => plainToInstance(AuthTokensDto, response)));
  }
}
