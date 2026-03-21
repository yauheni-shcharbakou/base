import {
  GrpcBaseQuery,
  GrpcDownloadMap,
  GrpcFile,
  GrpcFileCreate,
  GrpcFileGetListResponse,
  GrpcFileService,
  GrpcFileServiceController,
  GrpcFileUploadResponse,
  GrpcGetListRequest,
  GrpcIdField,
  GrpcUploadRequest,
  GrpcUrlMap,
} from '@backend/grpc';
import { GrpcController, GrpcMetadataMapper, GrpcRxPipe } from '@backend/transport';
import { Metadata } from '@grpc/grpc-js';
import { Inject } from '@nestjs/common';
import { FILE_SERVICE, FileService } from 'modules/file/service/file.service';
import { from, Observable } from 'rxjs';

@GrpcController()
@GrpcFileService.ControllerMethods()
export class FileRpcController implements GrpcFileServiceController {
  constructor(@Inject(FILE_SERVICE) private readonly fileService: FileService) {}

  getUrlMap(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcUrlMap> {
    const ip = new GrpcMetadataMapper(metadata).get('ip');
    return from(this.fileService.getUrlMap(request, ip));
  }

  getDownloadMap(request: GrpcBaseQuery, metadata?: Metadata): Observable<GrpcDownloadMap> {
    const ip = new GrpcMetadataMapper(metadata).get('ip');
    return from(this.fileService.getDownloadMap(request, ip));
  }

  getById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return from(this.fileService.getById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }

  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcFileGetListResponse> {
    return from(this.fileService.getList(request));
  }

  createOne(request: GrpcFileCreate, metadata?: Metadata): Observable<GrpcFile> {
    const userId = new GrpcMetadataMapper(metadata).getOrThrow('user');
    return from(this.fileService.createOne(request, userId)).pipe(GrpcRxPipe.unwrapEither);
  }

  uploadOne(
    request: Observable<GrpcUploadRequest>,
    metadata?: Metadata,
  ): Observable<GrpcFileUploadResponse> {
    const userId = new GrpcMetadataMapper(metadata).get('user');
    return this.fileService.uploadOne(request, userId).pipe(GrpcRxPipe.unwrapEither);
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return from(this.fileService.deleteById(request.id)).pipe(GrpcRxPipe.unwrapEither);
  }
}
