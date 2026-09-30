import { Readable } from 'node:stream';

/**
 * Reads a stream of known length into one buffer allocated up front, so an original of 100 MB costs
 * 100 MB — not the chunks plus their concatenation, twice that at the peak. A stream that errors or
 * runs past `size` rejects; a shorter one is returned as far as it went.
 */
export async function readToBuffer(stream: Readable, size: number): Promise<Buffer> {
  const buffer = Buffer.allocUnsafe(size);
  let offset = 0;

  for await (const chunk of stream) {
    const bytes = chunk as Buffer;

    if (offset + bytes.length > size) {
      stream.destroy();
      throw new Error(`The stream is longer than the expected ${size} bytes`);
    }

    bytes.copy(buffer, offset);
    offset += bytes.length;
  }

  return offset === size ? buffer : buffer.subarray(0, offset);
}
