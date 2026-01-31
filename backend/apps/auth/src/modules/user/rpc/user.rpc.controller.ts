import { unwrapEither } from '@backend/common';
import { GrpcController } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import {
  GetListRequest,
  IdField,
  User,
  UserCreate,
  UserGetListResponse,
  UserList,
  UserRequest,
  UserServiceController,
  UserServiceControllerMethods,
  UserUpdateByIdRequest,
  UserUpdateRequest,
} from '@backend/grpc';
import { USER_REPOSITORY, UserRepository } from 'common/repositories/user/user.repository';
import { USER_SERVICE, UserService } from 'modules/user/service/user.service';
import { map, Observable } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

@GrpcController()
@UserServiceControllerMethods()
export class UserRpcController implements UserServiceController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_SERVICE) private readonly userService: UserService,
  ) {}

  getById(request: IdField, metadata?: Metadata): Promise<User> | Observable<User> | User {
    return fromPromise(this.userRepository.getById(request.id)).pipe(unwrapEither());
  }

  getOne(request: UserRequest, metadata?: Metadata): Promise<User> | Observable<User> | User {
    return fromPromise(this.userRepository.getOne(request.query)).pipe(unwrapEither());
  }

  getMany(
    request: UserRequest,
    metadata?: Metadata,
  ): Promise<UserList> | Observable<UserList> | UserList {
    return fromPromise(this.userRepository.getMany(request.query)).pipe(
      map((users) => ({ items: users })),
    );
  }

  getList(
    request: GetListRequest,
    metadata?: Metadata,
  ): Promise<UserGetListResponse> | Observable<UserGetListResponse> | UserGetListResponse {
    return fromPromise(this.userRepository.getList(request));
  }

  createOne(request: UserCreate, metadata?: Metadata): Promise<User> | Observable<User> | User {
    return fromPromise(this.userService.create(request)).pipe(unwrapEither());
  }

  updateOne(
    request: UserUpdateRequest,
    metadata?: Metadata,
  ): Promise<User> | Observable<User> | User {
    return fromPromise(this.userRepository.updateOne(request.query, request.update)).pipe(
      unwrapEither(),
    );
  }

  deleteOne(request: UserRequest, metadata?: Metadata): Promise<User> | Observable<User> | User {
    return fromPromise(this.userRepository.deleteOne(request.query)).pipe(unwrapEither());
  }

  updateById(
    request: UserUpdateByIdRequest,
    metadata?: Metadata,
  ): Promise<User> | Observable<User> | User {
    return fromPromise(this.userRepository.updateOne({ id: request.id }, request.update)).pipe(
      unwrapEither(),
    );
  }

  deleteById(request: IdField, metadata?: Metadata): Promise<User> | Observable<User> | User {
    return fromPromise(this.userRepository.deleteById(request.id)).pipe(unwrapEither());
  }
}
