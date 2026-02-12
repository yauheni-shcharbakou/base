import {
  GrpcAuthService,
  GrpcAuthServiceClient,
  GrpcFile,
  GrpcFileCreate,
  GrpcFileGetListResponse,
  GrpcFileService,
  GrpcFileServiceClient,
  GrpcFileServiceController,
  GrpcFileUpdateByIdRequest,
  GrpcFileUpload,
  GrpcGetListRequest,
  GrpcIdField,
  GrpcUserRole,
} from '@backend/grpc';
import { GrpcRxPipe, InjectGrpcService, ValidateGrpcPayload } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { ForbiddenException } from '@nestjs/common';
import { AdminGrpcController, PublicAccess } from 'common/decorators/access.decorator';
import { GetListRequestDto } from 'common/dto/get-list-request.dto';
import { IdFieldDto } from 'common/dto/id-field.dto';
import { FileCreateDto, FileUpdateByIdRequestDto } from 'common/dto/services/file.service.dto';
import { catchError, finalize, map, Observable, ReplaySubject, switchMap } from 'rxjs';

@AdminGrpcController()
@GrpcFileService.ControllerMethods()
export class FileRpcController implements GrpcFileServiceController {
  constructor(
    @InjectGrpcService(GrpcAuthService.name)
    private readonly authServiceClient: GrpcAuthServiceClient,
    @InjectGrpcService(GrpcFileService.name)
    private readonly fileServiceClient: GrpcFileServiceClient,
  ) {}

  @ValidateGrpcPayload(IdFieldDto)
  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return this.fileServiceClient.getById(request, metadata);
  }

  @ValidateGrpcPayload(GetListRequestDto)
  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcFileGetListResponse> {
    return this.fileServiceClient.getList(request, metadata);
  }

  @ValidateGrpcPayload(FileCreateDto)
  createOne(request: GrpcFileCreate, metadata?: Metadata): Observable<GrpcFile> {
    return this.fileServiceClient.createOne(request, metadata);
  }

  @PublicAccess()
  uploadOne(request: Observable<GrpcFileUpload>, metadata?: Metadata): Observable<GrpcFile> {
    const proxy$ = new ReplaySubject<GrpcFileUpload>();
    const subscription = request.subscribe(proxy$);
    const accessToken = metadata?.get('access-token')?.[0]?.toString();

    if (!accessToken) {
      const error = new ForbiddenException('Access token is required');
      proxy$.error(error);
      throw error;
    }

    return this.authServiceClient.me({ accessToken }).pipe(
      map((user) => {
        if (user.role !== GrpcUserRole.ADMIN) {
          throw new ForbiddenException();
        }

        return;
      }),
      catchError((err) => {
        proxy$.error(err);
        throw err;
      }),
      switchMap(() => this.fileServiceClient.uploadOne(proxy$.asObservable(), metadata)),
      GrpcRxPipe.rpcException,
      finalize(() => subscription.unsubscribe()),
    );
  }

  @ValidateGrpcPayload(FileUpdateByIdRequestDto)
  updateById(request: GrpcFileUpdateByIdRequest, metadata?: Metadata): Observable<GrpcFile> {
    return this.fileServiceClient.updateById(request, metadata);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return this.fileServiceClient.deleteById(request, metadata);
  }
}
