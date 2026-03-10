import { getErrorMessage } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import { videoGrpcRepository } from '@/features/grpc/repositories';
import { NextResponse } from 'next/server';

// export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
//   try {
//     const authMeta = await authService.getAuthMetadata();
//     const id = (await params).id;
//
//     const response = await videoGrpcRepository.getDownloadUrls({ id, ids: [] }, authMeta);
//     const url = response.urls.get(id);
//
//     if (!url) {
//       throw new Error("Can't get download url for video");
//     }
//
//     return NextResponse.redirect(url);
//   } catch (error) {
//     return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
//   }
// }

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authMeta = await authService.getAuthMetadata();
    const id = (await params).id;

    const response = await videoGrpcRepository.getDownloadMap({ id, ids: [] }, authMeta);
    const downloadData = response.items.get(id);

    if (!downloadData) {
      throw new Error("Can't get download url for video");
    }

    const videoResponse = await fetch(downloadData.url, { headers: request.headers });

    console.log(videoResponse.status);

    if (!videoResponse.ok) {
      return NextResponse.json(
        { message: 'Error during download video' },
        { status: videoResponse.status },
      );
    }

    if (!videoResponse.body) {
      return NextResponse.json({ error: 'Empty video' }, { status: 400 });
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
