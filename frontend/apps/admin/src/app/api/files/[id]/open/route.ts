import { getErrorMessage } from '@/common/helpers';
import { authService } from '@/features/auth/services';
import { fileGrpcRepository } from '@/features/grpc/repositories';
import { NextResponse } from 'next/server';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authMeta = await authService.getAuthMetadata();
    const id = (await params).id;

    const response = await fileGrpcRepository.getSignedUrls({ id, ids: [] }, authMeta);
    const url = response.urls.get(id);

    if (!url) {
      throw new Error("Can't get signed url for file");
    }

    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
