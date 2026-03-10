import { authService } from '@/features/auth/services';
import { videoGrpcRepository } from '@/features/grpc/repositories';
import {
  GrpcStorageObjectType,
  GrpcVideoCreateRequest,
  GrpcVideoUploadRequest,
  GrpcVideoUploadResponse,
} from '@frontend/grpc';
import { ClientDuplexStream } from '@grpc/grpc-js';
import Busboy from 'busboy';
import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

export async function POST(req: Request): Promise<NextResponse> {
  if (!req.body) {
    return NextResponse.json({ message: 'Body is required' }, { status: 400 });
  }

  try {
    const authMetadata = await authService.getAuthMetadata();

    const headers = Object.fromEntries(req.headers.entries());
    const reqBody$ = Readable.fromWeb(req.body as ReadableStream);
    let request$: ClientDuplexStream<GrpcVideoUploadRequest, GrpcVideoUploadResponse>;

    return new Promise<NextResponse>((resolve) => {
      const busboy$ = Busboy({ headers });

      let fileProcessed = false;
      let fileStreamingStarted = false;
      const formData: Record<string, string> = {};

      const timeout = setTimeout(() => {
        clearTimeout(timeout);
        request$?.cancel();
        reqBody$.destroy();
        resolve(NextResponse.json({ message: 'Upload timeout' }, { status: 504 }));
      }, 600_000);

      busboy$.on('field', (name, val) => {
        formData[name] = val;
      });

      busboy$.on('file', (_name, file$, fileInfo) => {
        reqBody$.pause();
        file$.pause();

        fileProcessed = true;

        const createData: GrpcVideoCreateRequest = {
          video: {
            title: formData['video.title'] || fileInfo.filename,
            description: formData['video.description'] || undefined,
          },
          file: {
            originalName: fileInfo.filename,
            size: +(formData['file.size'] || 0),
            mimeType: fileInfo.mimeType,
          },
        };

        if (formData['storage.parent']) {
          createData.storage = {
            name: formData['storage.name'] || fileInfo.filename,
            isPublic: formData['storage.isPublic'] === 'true',
            parent: formData['storage.parent'],
            type: GrpcStorageObjectType.VIDEO,
          };
        }

        videoGrpcRepository
          .createOne(createData, authMetadata)
          .then((createdVideo) => {
            request$ = videoGrpcRepository.getClient().uploadOne(authMetadata);

            request$.on('data', (response: GrpcVideoUploadResponse) => {
              if (response.video) {
                clearTimeout(timeout);
                return resolve(NextResponse.json(response.video));
              }

              if (response.canSendChunks && !fileStreamingStarted) {
                fileStreamingStarted = true;

                file$.on('data', (chunk: Buffer) => {
                  const result = request$.write({ chunk: Buffer.from(chunk) });

                  if (!result) {
                    reqBody$.pause();
                    file$.pause();

                    request$.once('drain', () => {
                      file$.resume();
                      reqBody$.resume();
                    });
                  }
                });

                file$.on('end', () => {
                  request$.end();
                });

                file$.on('error', (err) => {
                  request$.cancel();
                  resolve(NextResponse.json({ message: 'Video stream error' }, { status: 500 }));
                });

                file$.resume();
                reqBody$.resume();
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

            request$.write({ video: createdVideo.id });
          })
          .catch((error) => {
            clearTimeout(timeout);

            request$?.cancel();
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
        request$?.cancel();
        reqBody$.destroy();
        resolve(NextResponse.json({ message: 'Parse error' }, { status: 500 }));
      });

      busboy$.on('finish', () => {
        if (!fileProcessed) {
          request$?.cancel();
          resolve(NextResponse.json({ error: 'No video provided' }, { status: 400 }));
        }
      });

      reqBody$.pipe(busboy$);
    });
  } catch (err) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
}
