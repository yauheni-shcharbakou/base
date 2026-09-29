import { authService } from '@/features/auth/services';
import { errorResponse } from '@/features/grpc/helpers/error-response';
import { videoGrpcRepository } from '@/features/grpc/repositories';
import {
  toDownloadResponseInit,
  toUpstreamHeaders,
} from '@/features/storage/helpers/download-proxy';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authMeta = await authService.getAuthMetadata();
    const id = (await params).id;
    const response = await videoGrpcRepository.getDownloadMap({ id, ids: [] }, authMeta);
    const downloadData = response.entries.get(id);

    if (!downloadData) {
      return NextResponse.json(
        {
          message:
            'No download URL for this video: it does not exist or has not finished uploading',
        },
        { status: 404 },
      );
    }

    const videoResponse = await fetch(downloadData.url, {
      headers: toUpstreamHeaders(request.headers),
    });

    if (!videoResponse.ok) {
      return NextResponse.json(
        { message: 'Error during download video' },
        { status: videoResponse.status },
      );
    }

    if (!videoResponse.body) {
      return NextResponse.json({ message: 'Empty video' }, { status: 502 });
    }

    return new NextResponse(
      videoResponse.body,
      toDownloadResponseInit(videoResponse, downloadData.fileName),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
