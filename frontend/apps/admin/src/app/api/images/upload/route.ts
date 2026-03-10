import { getErrorMessage } from '@/common/helpers';
import { configService } from '@/common/services';
import { authService } from '@/features/auth/services';
import { fileGrpcRepository, imageGrpcRepository } from '@/features/grpc/repositories';
import {
  GrpcFileUploadResponse,
  GrpcImageCreateRequest,
  GrpcStorageObjectType,
} from '@frontend/grpc';
import { sendToGrpcStream } from '@packages/common';
import { NextResponse } from 'next/server';
import sharp from 'sharp';

// TODO: try duplicate isFinished logic for file upload endpoint

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authMetadata = await authService.getAuthMetadata();
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const imageMetadata = await sharp(fileBuffer).metadata();

    const width = imageMetadata.width;
    const height = imageMetadata.height;

    if (!width || !height) {
      return NextResponse.json({ error: 'Invalid image metadata' }, { status: 400 });
    }

    const createData: GrpcImageCreateRequest = {
      file: {
        originalName: file.name,
        size: file.size || 0,
        mimeType: file.type,
      },
      image: {
        alt: formData.get('image.alt')?.toString() || 'image',
        width,
        height,
      },
    };

    const parent = formData.get('storage.parent')?.toString();

    if (parent) {
      createData.storage = {
        parent,
        name: formData.get('storage.name')?.toString() || file.name,
        isPublic: formData.get('storage.isPublic') === 'true',
        type: GrpcStorageObjectType.IMAGE,
      };
    }

    const image = await imageGrpcRepository.createOne(createData, authMetadata);
    const chunkSize = configService.getChunkSize();

    return new Promise<NextResponse>((resolve) => {
      let isFinished = false;
      let fileStreamingStarted = false;
      const request$ = fileGrpcRepository.getClient().uploadOne(authMetadata);

      const cleanup = (timeoutId: NodeJS.Timeout) => {
        clearTimeout(timeoutId);
        isFinished = true;
      };

      const timeout = setTimeout(() => {
        if (isFinished) {
          return;
        }

        cleanup(timeout);
        request$.cancel();
        resolve(NextResponse.json({ message: 'Upload timeout' }, { status: 504 }));
      }, 30_000);

      const sendBuffer = async () => {
        let offset = 0;

        while (offset < fileBuffer.length && !isFinished) {
          const end = Math.min(offset + chunkSize, fileBuffer.length);
          const chunk = fileBuffer.subarray(offset, end);
          await sendToGrpcStream(request$, { chunk: new Uint8Array(chunk) });
          offset += chunkSize;
        }
      };

      request$.on('data', (response: GrpcFileUploadResponse) => {
        if (isFinished) {
          return;
        }

        if (response.file) {
          cleanup(timeout);
          return resolve(NextResponse.json(image));
        }

        if (response.canSendChunks && !fileStreamingStarted) {
          fileStreamingStarted = true;

          sendBuffer()
            .then(() => {
              if (!isFinished) {
                request$.end();
              }
            })
            .catch(() => {
              if (isFinished) {
                return;
              }

              cleanup(timeout);
              request$.cancel();
              resolve(NextResponse.json({ message: 'File stream error' }, { status: 500 }));
            });
        }
      });

      request$.on('error', (error) => {
        if (isFinished) {
          return;
        }

        cleanup(timeout);

        resolve(
          NextResponse.json(
            { message: 'details' in error ? error.details : error.message },
            { status: 500 },
          ),
        );
      });

      request$.write({ file: image.fileId });
    });
  } catch (err) {
    return NextResponse.json({ message: getErrorMessage(err) }, { status: 500 });
  }
}
