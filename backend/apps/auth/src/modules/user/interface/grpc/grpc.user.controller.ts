import { GrpcController, GrpcRxPipe } from '@backend/grpc';
import { GrpcUserServiceController, GrpcUserTransport, NestAuth, NestCommon } from '@backend/proto';
import { UserCreateOneUseCase } from '@modules/user/application/use-cases/user.create-one.use-case';
import { UserDeleteUseCase } from '@modules/user/application/use-cases/user.delete.use-case';
import { UserGetUseCase } from '@modules/user/application/use-cases/user.get.use-case';
import { UserUpdateOneUseCase } from '@modules/user/application/use-cases/user.update-one.use-case';
import { from, Observable } from 'rxjs';

@GrpcController()
@GrpcUserTransport.ControllerMethods()
export class GrpcUserController implements GrpcUserServiceController {
  constructor(
    private readonly getUseCase: UserGetUseCase,
    private readonly deleteUseCase: UserDeleteUseCase,
    private readonly createOneUseCase: UserCreateOneUseCase,
    private readonly updateOneUseCase: UserUpdateOneUseCase,
  ) {}

  getById(request: NestCommon.IdField): Observable<NestAuth.User> {
    return from(this.getUseCase.getById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }

  getMany(request: NestAuth.UserQuery): Observable<NestAuth.UserArray> {
    return from(this.getUseCase.getMany(request)).pipe(GrpcRxPipe.toArrayItems);
  }

  getList(request: NestCommon.GetList): Observable<NestAuth.UserList> {
    return from(this.getUseCase.getList(request));
  }

  createOne(request: NestAuth.UserCreate): Observable<NestAuth.User> {
    return from(this.createOneUseCase.execute(request)).pipe(GrpcRxPipe.unwrapEither);
  }

  updateById(request: NestAuth.UserUpdateById): Observable<NestAuth.User> {
    const stream$ = from(this.updateOneUseCase.execute({ id: request.id }, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: NestCommon.IdField): Observable<NestAuth.User> {
    return from(this.deleteUseCase.deleteById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }
}
