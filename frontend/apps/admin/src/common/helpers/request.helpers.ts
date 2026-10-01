import zod from 'zod';

const ipSchema = zod.union([zod.ipv4(), zod.ipv6()]);

/**
 * The client's address, read from the one header the proxy in front of this server is known to
 * overwrite — never from whatever address headers the request carries, which its sender writes.
 * Of a list, the last entry: the one the nearest proxy added. Anything that is not an address is
 * no address.
 */
export const getHeadersIp = (
  headers: Pick<Headers, 'get'>,
  headerName: string,
): string | undefined => {
  const clientIp = headers.get(headerName)?.split(',').pop()?.trim();

  if (clientIp && ipSchema.safeParse(clientIp).success) {
    return clientIp;
  }
};
