import { unwrapEither } from '@backend/common';
import { GrpcController } from '@backend/transport';
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
    return fromPromise(this.userRepository.getById(request.id)).pipe(unwrapEither());
  }

  getOne(request: GrpcUserRequest, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.userRepository.getOne(request.query)).pipe(unwrapEither());
  }

  getMany(request: GrpcUserRequest, metadata?: Metadata): Observable<GrpcUserList> {
    return fromPromise(this.userRepository.getMany(request.query)).pipe(
      map((users) => ({ items: users })),
    );
  }

  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcUserGetListResponse> {
    return fromPromise(this.userRepository.getList(request));
  }

  createOne(request: GrpcUserCreate, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.userService.create(request)).pipe(unwrapEither());
  }

  updateOne(request: GrpcUserUpdateRequest, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.userRepository.updateOne(request.query, request.update)).pipe(
      unwrapEither(),
    );
  }

  deleteOne(request: GrpcUserRequest, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.userRepository.deleteOne(request.query)).pipe(unwrapEither());
  }

  updateById(request: GrpcUserUpdateByIdRequest, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.userRepository.updateOne({ id: request.id }, request.update)).pipe(
      unwrapEither(),
    );
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcUser> {
    return fromPromise(this.userRepository.deleteById(request.id)).pipe(unwrapEither());
  }
}
