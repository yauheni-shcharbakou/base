export const getHeadersIp = (headers: Pick<Headers, 'get'>): string | undefined => {
  const forwardedFor = headers.get('x-forwarded-for') || headers.get('X-Forwarded-For');

  if (forwardedFor) {
    const clientIp = forwardedFor.split(',')[0]?.trim();

    if (clientIp) {
      return clientIp;
    }
  }

  const realIp = headers.get('x-real-ip') || headers.get('X-Real-IP');

  if (realIp) {
    const clientIp = realIp.split(',')[0]?.trim();

    if (clientIp) {
      return clientIp;
    }
  }
};
