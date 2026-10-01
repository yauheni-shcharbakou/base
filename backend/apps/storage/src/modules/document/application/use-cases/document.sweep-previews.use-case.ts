import { NestStorage } from '@backend/proto';
import { Config } from '@/config';
import { PreviewSweepUseCase } from '@common/application/use-cases/preview.sweep.use-case';
import {
  DocumentMakePreviewUseCase,
  PREVIEWABLE_DOCUMENT_TYPES,
} from '@modules/document/application/use-cases/document.make-preview.use-case';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Either } from '@sweet-monads/either';

/** The preview sweep over PDFs, tuned by `STORAGE_DOCUMENT_PREVIEW_SWEEP_*`. */
@Injectable()
export class DocumentSweepPreviewsUseCase extends PreviewSweepUseCase<NestStorage.File> {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly makePreviewUseCase: DocumentMakePreviewUseCase,
    configService: ConfigService<Config>,
  ) {
    super('Document', configService.getOrThrow('documentPreviewSweep', { infer: true }));
  }

  protected getRows(
    readyBefore: Date,
    limit: number,
    afterId?: string,
  ): Promise<NestStorage.File[]> {
    return this.fileRepository.getManyWithoutPreview(
      PREVIEWABLE_DOCUMENT_TYPES,
      readyBefore,
      limit,
      afterId,
    );
  }

  protected makePreview(file: NestStorage.File): Promise<Either<Error, boolean>> {
    return this.makePreviewUseCase.execute({ fileId: file.id });
  }

  protected countPreviewAttempt(id: string, maxAttempts: number): Promise<Either<Error, boolean>> {
    return this.fileRepository.countPreviewAttempt(id, maxAttempts);
  }
}
