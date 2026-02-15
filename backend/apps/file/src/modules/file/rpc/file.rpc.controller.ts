import { unwrapEither } from '@backend/common';
import { GrpcController, GrpcMetadataMapper } from '@backend/transport';
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
  GrpcFileUpload,
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
    return fromPromise(this.fileRepository.getById(request.id)).pipe(unwrapEither());
  }

  getList(request: GrpcGetListRequest, metadata?: Metadata): Observable<GrpcFileGetListResponse> {
    return fromPromise(this.fileRepository.getList(request));
  }

  createOne(request: GrpcFileCreate, metadata?: Metadata): Observable<GrpcFile> {
    const user = new GrpcMetadataMapper(metadata).getOrThrow('user');
    return fromPromise(this.fileRepository.saveOne({ ...request, user })).pipe(unwrapEither());
  }

  uploadOne(request: Observable<GrpcFileUpload>, metadata?: Metadata): Observable<GrpcFile> {
    const metaUser = new GrpcMetadataMapper(metadata).get('user');
    return this.fileService.uploadOne(request, metaUser).pipe(unwrapEither());
  }

  updateById(request: GrpcFileUpdateByIdRequest, metadata?: Metadata): Observable<GrpcFile> {
    return fromPromise(this.fileRepository.updateOne({ id: request.id }, request.update)).pipe(
      unwrapEither(),
    );
  }

  deleteById(request: GrpcIdField, metadata?: Metadata): Observable<GrpcFile> {
    return this.fileService.deleteById(request.id).pipe(unwrapEither());
  }
}
