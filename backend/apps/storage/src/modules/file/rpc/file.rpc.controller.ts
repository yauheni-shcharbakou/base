import {
  GrpcBaseQuery,
  GrpcFile,
  GrpcFileCreateRequest,
  GrpcFileGetListResponse,
  GrpcFileService,
  GrpcFileServiceController,
  GrpcFileSignedUrls,
  GrpcFileUploadRequest,
  GrpcGetListRequest,
  GrpcIdField,
} from '@backend/grpc';
import { GrpcController, GrpcMetadataMapper, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import { FILE_SERVICE, FileService } from 'modules/file/service/file.service';
import { Observable } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

@GrpcController()
@GrpcFileService.ControllerMethods()
export class FileRpcController implements GrpcFileServiceController {
  constructor(@Inject(FILE_SERVICE) private readonly fileService: FileService) {}

  getSignedUrls(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcFileSignedUrls> {
    return this.fileService.getSignedUrls(request);
  }

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return fromPromise(this.fileService.getById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }

  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcFileGetListResponse> {
    return fromPromise(this.fileService.getList(request));
  }

  createOne(request: GrpcFileCreateRequest, metadata?: Metadata): Observable<GrpcFile> {
    const user = new GrpcMetadataMapper(metadata).getOrThrow('user');
    return fromPromise(this.fileService.createOne(request, user)).pipe(GrpcRxPipe.unwrapEither);
  }

  uploadOne(request: Observable<GrpcFileUploadRequest>, metadata?: Metadata): Observable<GrpcFile> {
    const user = new GrpcMetadataMapper(metadata).get('user');
    return this.fileService.uploadOne(request, user).pipe(GrpcRxPipe.unwrapEither);
  }

  // uploadOne(
  //   request: Observable<GrpcFileUploadRequest>,
  //   metadata?: Metadata,
  // ): Observable<GrpcFileUploadResponse> {
  //   const metaUser = new GrpcMetadataMapper(metadata).get('user');
  //   return this.fileService.uploadOne(request, metaUser).pipe(GrpcRxPipe.unwrapEither);
  // }

  // uploadOneDuplex(
  //   request: Observable<GrpcFileUploadRequest>,
  //   metadata?: Metadata,
  // ): Observable<GrpcFileUploadResponse> {
  //   const metaUser = new GrpcMetadataMapper(metadata).get('user');
  //   return this.fileService.uploadOneDuplex(request, metaUser).pipe(GrpcRxPipe.unwrapEither);
  // }

  // updateById(request: GrpcFileUpdateByIdRequest, metadata?: Metadata): Observable<GrpcFile> {
  //   const stream$ = fromPromise(this.fileRepository.updateOne({ id: request.id }, request.update));
  //   return stream$.pipe(GrpcRxPipe.unwrapEither);
  // }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return fromPromise(this.fileService.deleteById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }
}
