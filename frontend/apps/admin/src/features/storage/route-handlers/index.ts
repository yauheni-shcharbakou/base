import { configService } from '@/common/services';
import type { ClientStorage } from '@frontend/proto';
import { ClientDuplexStream } from '@grpc/grpc-js';
import Busboy from 'busboy';
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

type UploadResponse = {
  canSendChunks?: boolean;
  entity?: any;
  ack?: boolean;
};

export const handleStreamFileUpload = <UploadRes extends UploadResponse>(
  req: NextRequest,
  id: string,
  reqStreamFactory: () => ClientDuplexStream<ClientStorage.UploadRequest, UploadRes>,
  timeoutSeconds: number,
) => {
  const headers = Object.fromEntries(req.headers.entries());
  const reqBody$ = Readable.fromWeb(req.body as ReadableStream);
  const chunkSize = configService.getChunkSize();

  let request$: ClientDuplexStream<ClientStorage.UploadRequest, UploadRes>;

  return new Promise<NextResponse>((resolve) => {
    const busboy$ = Busboy({ headers });

    let fileProcessed = false;
    let isResolved = false;

    let buffer: Buffer = Buffer.alloc(0);
    let isWaitingForAck = false;
    let isFileEnded = false;

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

    const sendAggregatedChunk = (fileStream: Readable) => {
      if (!buffer.length && isFileEnded) {
        request$.end();
        return;
      }

      if (!buffer.length) {
        return;
      }

      const sizeToSend = isFileEnded ? buffer.length : chunkSize;
      const chunkToSend = buffer.subarray(0, sizeToSend);
      buffer = buffer.subarray(sizeToSend);

      isWaitingForAck = true;

      fileStream.pause();
      reqBody$.pause();

      request$.write({ chunk: new Uint8Array(chunkToSend) });
    };

    busboy$.on('file', (_, file$) => {
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

        if (response.canSendChunks || response.ack) {
          isWaitingForAck = false;

          if (buffer.length >= chunkSize || isFileEnded) {
            sendAggregatedChunk(file$);
          } else {
            file$.resume();
            reqBody$.resume();
          }
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

      file$.on('data', (data: Buffer) => {
        buffer = Buffer.concat([buffer, data]);

        if (buffer.length >= chunkSize) {
          if (!isWaitingForAck) {
            sendAggregatedChunk(file$);
          } else {
            file$.pause();
            reqBody$.pause();
          }
        }
      });

      file$.on('end', () => {
        isFileEnded = true;

        if (!isWaitingForAck) {
          sendAggregatedChunk(file$);
        }
      });

      file$.on('error', () => {
        safeResolve(NextResponse.json({ message: 'File stream error' }, { status: 500 }));
      });

      request$.write({ id });
      isWaitingForAck = true;
    });

    busboy$.on('error', () => {
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
