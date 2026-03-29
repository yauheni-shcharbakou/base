import { GrpcController, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import {
  GrpcGetListRequest,
  GrpcIdField,
  GrpcUser,
  GrpcUserCreate,
  GrpcUserGetListResponse,
  GrpcUserList,
  GrpcUserRequest,
  GrpcUserService,
  GrpcUserServiceController,
  GrpcUserUpdateByIdRequest,
} from '@backend/grpc';
import { USER_SERVICE, UserService } from 'modules/user/service/user.service';
import { from, map, Observable } from 'rxjs';

@GrpcController()
@GrpcUserService.ControllerMethods()
export class UserRpcController implements GrpcUserServiceController {
  constructor(@Inject(USER_SERVICE) private readonly userService: UserService) {}

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcUser> {
    return from(this.userService.getById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }

  getOne(request: GrpcUserRequest, metadata?: Metadata): Observable<GrpcUser> {
    return from(this.userService.getOne(request.query)).pipe(GrpcRxPipe.unwrapEither);
  }

  getMany(request: GrpcUserRequest, metadata?: Metadata): Observable<GrpcUserList> {
    const stream$ = from(this.userService.getMany(request.query));
    return stream$.pipe(map((users) => ({ items: users })));
  }

  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcUserGetListResponse> {
    return from(this.userService.getList(request));
  }

  createOne(request: GrpcUserCreate, metadata?: Metadata): Observable<GrpcUser> {
    return from(this.userService.saveOne(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  updateById(request: GrpcUserUpdateByIdRequest, metadata?: Metadata): Observable<GrpcUser> {
    const stream$ = from(this.userService.updateById(request.id, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcUser> {
    return from(this.userService.deleteById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }
}
