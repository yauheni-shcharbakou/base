import { authService } from '@/features/auth/services';
import { errorResponse } from '@/features/grpc/helpers/error-response';
import { fileGrpcRepository } from '@/features/grpc/repositories';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authMeta = await authService.getAuthMetadata();
    const id = (await params).id;
    const response = await fileGrpcRepository.getUrlMap({ id, ids: [] }, authMeta);
    const url = response.entries.get(id);

    if (!url) {
      return NextResponse.json(
        { message: 'No URL for this file: it does not exist or has not finished uploading' },
        { status: 404 },
      );
    }

    return NextResponse.redirect(url);
  } catch (error) {
    return errorResponse(error);
  }
}
