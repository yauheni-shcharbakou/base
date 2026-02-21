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
  GrpcUserUpdateRequest,
} from '@backend/grpc';
import { USER_REPOSITORY, UserRepository } from 'common/repositories/user/user.repository';
import { USER_SERVICE, UserService } from 'modules/user/service/user.service';
import { map, Observable } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

@GrpcController()
@GrpcUserService.ControllerMethods()
export class UserRpcController implements GrpcUserServiceController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_SERVICE) private readonly userService: UserService,
  ) {}

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.userRepository.getById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }

  getOne(request: GrpcUserRequest, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.userRepository.getOne(request.query)).pipe(GrpcRxPipe.unwrapEither);
  }

  getMany(request: GrpcUserRequest, metadata?: Metadata): Observable<GrpcUserList> {
    const stream$ = fromPromise(this.userRepository.getMany(request.query));
    return stream$.pipe(map((users) => ({ items: users })));
  }

  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcUserGetListResponse> {
    return fromPromise(this.userRepository.getList(request));
  }

  createOne(request: GrpcUserCreate, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.userService.create(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  updateOne(request: GrpcUserUpdateRequest, metadata?: Metadata): Observable<GrpcUser> {
    const stream$ = fromPromise(this.userRepository.updateOne(request.query, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteOne(request: GrpcUserRequest, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.userRepository.deleteOne(request.query)).pipe(GrpcRxPipe.unwrapEither);
  }

  updateById(request: GrpcUserUpdateByIdRequest, metadata?: Metadata): Observable<GrpcUser> {
    const stream$ = fromPromise(this.userRepository.updateOne({ id: request.id }, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.userRepository.deleteById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }
}
