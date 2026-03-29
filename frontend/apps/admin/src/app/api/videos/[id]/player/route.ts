import { getErrorMessage, getRequestIp } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import { videoGrpcRepository } from '@/features/grpc/repositories';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authMeta = await authService.getAuthMetadata();
    const id = (await params).id;
    const ip = getRequestIp(request);

    if (ip) {
      authMeta.set('ip', ip);
    }

    const query = request.nextUrl.searchParams;

    const response = await videoGrpcRepository.getUrlMap({ id, ids: [] }, authMeta);
    const url = response.items.get(id);

    if (!url) {
      throw new Error("Can't get player url for video");
    }

    const redirectUrl = new URL(url);

    if (query.size) {
      query.forEach((value, key) => {
        redirectUrl.searchParams.set(key, value);
      });
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
