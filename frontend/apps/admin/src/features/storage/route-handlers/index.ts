import { GrpcUploadRequest } from '@frontend/grpc';
import { ClientDuplexStream } from '@grpc/grpc-js';
import Busboy from 'busboy';
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

type UploadResponse = {
  canSendChunks?: boolean;
  entity?: any;
};

export const handleStreamFileUpload = <UploadRes extends UploadResponse>(
  req: NextRequest,
  id: string,
  reqStreamFactory: () => ClientDuplexStream<GrpcUploadRequest, UploadRes>,
  timeoutSeconds: number,
) => {
  const headers = Object.fromEntries(req.headers.entries());
  const reqBody$ = Readable.fromWeb(req.body as ReadableStream);
  let request$: ClientDuplexStream<GrpcUploadRequest, UploadRes>;

  return new Promise<NextResponse>((resolve) => {
    const busboy$ = Busboy({ headers });

    let fileProcessed = false;
    let fileStreamingStarted = false;
    let isResolved = false;

    const safeResolve = (response: NextResponse) => {
      if (isResolved) {
        return;
      }

      isResolved = true;
      clearTimeout(timeout);

      request$?.cancel();
      reqBody$.unpipe(busboy$);
      reqBody$.destroy();
      busboy$.removeAllListeners();

      resolve(response);
    };

    const timeout = setTimeout(() => {
      safeResolve(NextResponse.json({ message: 'Upload timeout' }, { status: 504 }));
    }, timeoutSeconds * 1_000);

    reqBody$.on('aborted', () =>
      safeResolve(NextResponse.json({ message: 'Client aborted' }, { status: 499 })),
    );

    reqBody$.on('error', () =>
      safeResolve(NextResponse.json({ message: 'Stream error' }, { status: 500 })),
    );

    busboy$.on('file', (_name, file$) => {
      if (fileProcessed) {
        file$.resume();
        return;
      }

      fileProcessed = true;

      reqBody$.pause();
      file$.pause();

      request$ = reqStreamFactory();

      request$.on('data', (response: UploadRes) => {
        if (response.entity) {
          return safeResolve(NextResponse.json(response.entity));
        }

        if (response.canSendChunks && !fileStreamingStarted) {
          fileStreamingStarted = true;

          file$.on('data', (chunk: Buffer) => {
            const result = request$.write({ chunk });

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
            safeResolve(NextResponse.json({ message: 'File stream error' }, { status: 500 }));
          });

          file$.resume();
          reqBody$.resume();
        }
      });

      request$.on('error', (error) => {
        safeResolve(
          NextResponse.json(
            { message: 'details' in error ? (error as any).details : error.message },
            { status: 500 },
          ),
        );
      });

      request$.write({ id });
    });

    busboy$.on('error', (err) => {
      safeResolve(NextResponse.json({ message: 'Parse error' }, { status: 500 }));
    });

    busboy$.on('finish', () => {
      if (!fileProcessed) {
        safeResolve(NextResponse.json({ error: 'No file provided' }, { status: 400 }));
      }
    });

    reqBody$.pipe(busboy$);
  });
};
