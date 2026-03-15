import { getErrorMessage, getRequestIp } from '@/common/helpers';
import { configService } from '@/common/services';
import { authService } from '@/features/auth/services';
import { fileGrpcRepository } from '@/features/grpc/repositories';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authMeta = await authService.getAuthMetadata();
    const id = (await params).id;
    const ip = getRequestIp(request);

    if (!configService.isDevelopment) {
      if (!ip) {
        throw new Error(`IP is required for production`);
      }

      authMeta.set('ip', ip);
    }

    const response = await fileGrpcRepository.getDownloadMap({ id, ids: [] }, authMeta);
    const downloadData = response.items.get(id);

    if (!downloadData) {
      throw new Error("Can't get download url for file");
    }

    const videoResponse = await fetch(downloadData.url);

    if (!videoResponse.ok) {
      return NextResponse.json(
        { message: 'Error during download file' },
        { status: videoResponse.status },
      );
    }

    if (!videoResponse.body) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }

    const headers = new Headers();

    const contentType = videoResponse.headers.get('content-type');
    const contentLength = videoResponse.headers.get('content-length');

    headers.set('Content-Disposition', `attachment; filename="${downloadData.fileName}"`);
    headers.set('Content-Type', contentType || 'application/octet-stream');

    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    return new NextResponse(videoResponse.body, { status: 200, headers });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
