import { authService } from '@/features/auth/services';
import { fileGrpcRepository } from '@/features/grpc/repositories';
import {
  GrpcFile,
  GrpcFileCreateRequest,
  GrpcFileUploadRequest,
  GrpcFileUploadStatus,
  GrpcStorageObjectType,
} from '@frontend/grpc';
import { ClientDuplexStream } from '@grpc/grpc-js';
import Busboy from 'busboy';
import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authMetadata = await authService.getAuthMetadata();

    const headers = Object.fromEntries(req.headers.entries());
    const reqBody$ = Readable.fromWeb(req.body as any);
    let request$: ClientDuplexStream<GrpcFileUploadRequest, GrpcFile>;

    return new Promise<NextResponse>((resolve) => {
      const busboy$ = Busboy({ headers });

      let fileProcessed = false;
      let fileStreamingStarted = false;
      const formData: Record<string, string> = {};

      const timeout = setTimeout(() => {
        clearTimeout(timeout);

        if (request$) {
          request$.cancel();
        }

        reqBody$.destroy();
        resolve(NextResponse.json({ message: 'Upload timeout' }, { status: 504 }));
      }, 180_000);

      busboy$.on('field', (name, val) => {
        formData[name] = val;
      });

      busboy$.on('file', (_name, file$, _info) => {
        file$.pause();
        fileProcessed = true;

        const createData: GrpcFileCreateRequest = {
          file: {
            originalName: formData['file.name'],
            size: +(formData['file.size'] || 0),
            mimeType: formData['file.type'],
          },
        };

        if (formData['storage.parent']) {
          createData.storage = {
            name: formData['storage.name'] || formData['file.name'],
            isPublic: formData['storage.isPublic'] === 'true',
            parent: formData['storage.parent'],
            type: GrpcStorageObjectType.FILE,
          };
        }

        fileGrpcRepository
          .createOne(createData, authMetadata)
          .then((createdFile) => {
            request$ = fileGrpcRepository.getClient().uploadOne(authMetadata);

            request$.on('data', (file: GrpcFile) => {
              if (file.uploadStatus === GrpcFileUploadStatus.READY) {
                clearTimeout(timeout);
                return resolve(NextResponse.json(file));
              }

              if (!fileStreamingStarted) {
                fileStreamingStarted = true;

                file$.on('data', (chunk: Buffer) => {
                  const result = request$.write({ chunk: Buffer.from(chunk) });

                  if (!result) {
                    file$.pause();
                    request$.once('drain', () => file$.resume());
                  }
                });

                file$.on('end', () => {
                  request$.end();
                });

                file$.on('error', (err) => {
                  request$.cancel();
                  resolve(NextResponse.json({ message: 'File stream error' }, { status: 500 }));
                });

                file$.resume();
                return;
              }
            });

            request$.on('error', (error) => {
              clearTimeout(timeout);

              reqBody$.unpipe(busboy$);
              reqBody$.destroy();
              busboy$.removeAllListeners();

              resolve(
                NextResponse.json(
                  { message: 'details' in error ? error.details : error.message },
                  { status: 500 },
                ),
              );
            });

            request$.write({ file: createdFile.id });
          })
          .catch((error) => {
            clearTimeout(timeout);

            request$.cancel();
            reqBody$.unpipe(busboy$);
            reqBody$.destroy();
            busboy$.removeAllListeners();

            resolve(
              NextResponse.json(
                { message: 'details' in error ? error.details : error.message },
                { status: 500 },
              ),
            );
          });
      });

      busboy$.on('error', (err) => {
        clearTimeout(timeout);

        if (request$) {
          request$.cancel();
        }

        reqBody$.destroy();

        resolve(NextResponse.json({ message: 'Parse error' }, { status: 500 }));
      });

      busboy$.on('finish', () => {
        if (!fileProcessed) {
          if (request$) {
            request$.cancel();
          }

          resolve(NextResponse.json({ error: 'No file provided' }, { status: 400 }));
        }
      });

      reqBody$.pipe(busboy$);
    });
  } catch (err) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
}
