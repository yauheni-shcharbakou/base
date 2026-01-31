// import {
//   GrpcController,
//   GrpcRxPipe,
//   InjectGrpcService,
//   ValidateGrpcPayload,
// } from '@backend/transport';
// import { Metadata } from '@grpc/grpc-js';
// import {
//   AUTH_SERVICE_NAME,
//   AuthData,
//   AuthLogin,
//   AuthMe,
//   AuthRefresh,
//   AuthServiceClient,
//   AuthServiceController,
//   AuthServiceControllerMethods,
//   AuthTokens,
//   User,
// } from '@packages/grpc.nest';
// import { AuthLoginDto } from 'modules/auth/dto/auth.login.dto';
// import { AuthMeDto } from 'modules/auth/dto/auth.me.dto';
// import { AuthRefreshDto } from 'modules/auth/dto/auth.refresh.dto';
// import { Observable } from 'rxjs';
//
// @GrpcController()
// @AuthServiceControllerMethods()
// export class AuthRpcController implements AuthServiceController {
//   constructor(
//     @InjectGrpcService(AUTH_SERVICE_NAME)
//     private readonly authServiceClient: AuthServiceClient,
//   ) {}
//
//   @ValidateGrpcPayload(AuthLoginDto)
//   login(
//     request: AuthLogin,
//     metadata?: Metadata,
//   ): Promise<AuthData> | Observable<AuthData> | AuthData {
//     return this.authServiceClient.login(request).pipe(GrpcRxPipe.proxy());
//   }
//
//   @ValidateGrpcPayload(AuthRefreshDto)
//   refreshToken(
//     request: AuthRefresh,
//     metadata?: Metadata,
//   ): Promise<AuthTokens> | Observable<AuthTokens> | AuthTokens {
//     return this.authServiceClient.refreshToken(request).pipe(GrpcRxPipe.proxy());
//   }
//
//   @ValidateGrpcPayload(AuthMeDto)
//   me(request: AuthMe, metadata?: Metadata): Promise<User> | Observable<User> | User {
//     return this.authServiceClient.me(request).pipe(GrpcRxPipe.proxy());
//   }
// }
