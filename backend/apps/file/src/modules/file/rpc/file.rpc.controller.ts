import { GrpcController, GrpcMetadataMapper, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import {
  GrpcBaseQuery,
  GrpcFile,
  GrpcFileCreate,
  GrpcFileGetListResponse,
  GrpcFileService,
  GrpcFileServiceController,
  GrpcFileSignedUrls,
  GrpcFileUpdateByIdRequest,
  GrpcFileUploadRequest,
  GrpcFileUploadResponse,
  GrpcGetListRequest,
  GrpcIdField,
} from '@backend/grpc';
import { FILE_REPOSITORY, FileRepository } from 'common/repositories/file/file.repository';
import { FILE_SERVICE, FileService } from 'modules/file/service/file.service';
import { Observable } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

@GrpcController()
@GrpcFileService.ControllerMethods()
export class FileRpcController implements GrpcFileServiceController {
  constructor(
    @Inject(FILE_REPOSITORY) private readonly fileRepository: FileRepository,
    @Inject(FILE_SERVICE) private readonly fileService: FileService,
  ) {}

  getSignedUrls(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcFileSignedUrls> {
    return this.fileService.getSignedUrls(request);
  }

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return fromPromise(this.fileRepository.getById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }

  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcFileGetListResponse> {
    return fromPromise(this.fileRepository.getList(request));
  }

  createOne(request: GrpcFileCreate, metadata?: Metadata): Observable<GrpcFile> {
    const user = new GrpcMetadataMapper(metadata).getOrThrow('user');
    const stream$ = fromPromise(this.fileRepository.saveOne({ ...request, user }));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  uploadOne(
    request: Observable<GrpcFileUploadRequest>,
    metadata?: Metadata,
  ): Observable<GrpcFileUploadResponse> {
    const metaUser = new GrpcMetadataMapper(metadata).get('user');
    return this.fileService.uploadOne(request, metaUser).pipe(GrpcRxPipe.unwrapEither);
  }

  updateById(request: GrpcFileUpdateByIdRequest, metadata?: Metadata): Observable<GrpcFile> {
    const stream$ = fromPromise(this.fileRepository.updateOne({ id: request.id }, request.update));
    return stream$.pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return this.fileService.deleteById(request.id).pipe(GrpcRxPipe.unwrapEither);
  }
}
