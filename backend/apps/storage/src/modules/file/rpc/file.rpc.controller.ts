import {
  GrpcBaseQuery,
  GrpcFile,
  GrpcFileCreateRequest,
  GrpcFileGetListResponse,
  GrpcFileService,
  GrpcFileServiceController,
  GrpcFileSignedUrls,
  GrpcFileUploadRequest,
  GrpcFileUploadResponse,
  GrpcGetListRequest,
  GrpcIdField,
} from '@backend/grpc';
import { GrpcController, GrpcMetadataMapper, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject, SetMetadata } from '@nestjs/common';
import { FILE_SERVICE, FileService } from 'modules/file/service/file.service';
import { from, Observable } from 'rxjs';

@GrpcController()
@GrpcFileService.ControllerMethods()
export class FileRpcController implements GrpcFileServiceController {
  constructor(@Inject(FILE_SERVICE) private readonly fileService: FileService) {}

  getSignedUrls(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcFileSignedUrls> {
    return from(this.fileService.getSignedUrls(request));
  }

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return from(this.fileService.getById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }

  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcFileGetListResponse> {
    return from(this.fileService.getList(request));
  }

  createOne(request: GrpcFileCreateRequest, metadata?: Metadata): Observable<GrpcFile> {
    const user = new GrpcMetadataMapper(metadata).getOrThrow('user');
    return from(this.fileService.createOne(request, user)).pipe(GrpcRxPipe.unwrapEither);
  }

  @SetMetadata('grpc-stream', true)
  uploadOne(
    request: Observable<GrpcFileUploadRequest>,
    metadata?: Metadata,
  ): Observable<GrpcFileUploadResponse> {
    const user = new GrpcMetadataMapper(metadata).get('user');
    return this.fileService.uploadOne(request, user).pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return from(this.fileService.deleteById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }
}
