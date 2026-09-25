/**
 * One-off copy of every object from a Bunny storage zone into an S3-enabled one.
 *
 * Bunny turns S3 compatibility on only when a zone is created, so moving the file store onto the
 * S3 API means a new zone and a copy. Keys are kept verbatim — `files.provider_id` stays valid and
 * the database is never touched. The source is read over the HTTP storage API (listing + GET),
 * the target is written over S3 (HEAD + PutObject).
 *
 * Idempotent: an object already present in the target with the same size is skipped, so a second
 * run after the cut-over only copies what landed in the old zone in between.
 *
 * Env (see `.env.migration.example`):
 *   SOURCE_ZONE, SOURCE_API_KEY, SOURCE_ENDPOINT (default https://storage.bunnycdn.com)
 *   TARGET_ZONE, TARGET_API_KEY, TARGET_REGION (default de)
 *
 * Flags:
 *   --dry-run          list and compare only, write nothing
 *   --verify-only      HEAD every source key in the target, report missing / size mismatches
 *   --prefix=<path>    copy one subtree, e.g. `prod/` (default: the whole zone)
 *   --concurrency=<n>  parallel transfers (default 8; Bunny S3 caps at 500 rps per zone)
 */
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { parseArgs } from 'node:util';

interface BunnyListItem {
  ObjectName: string;
  Path: string;
  Length: number;
  IsDirectory: boolean;
  ContentType: string;
  Checksum: string | null;
}

interface SourceObject {
  key: string;
  size: number;
  contentType?: string;
  sha256Hex?: string;
}

type Outcome = 'copied' | 'skipped' | 'failed' | 'missing' | 'mismatch' | 'ok' | 'pending';

const MAX_ATTEMPTS = 4;

const { values: flags } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    'verify-only': { type: 'boolean', default: false },
    prefix: { type: 'string', default: '' },
    concurrency: { type: 'string', default: '8' },
  },
});

const requireEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env ${name}`);
  }

  return value;
};

const source = {
  zone: requireEnv('SOURCE_ZONE'),
  apiKey: requireEnv('SOURCE_API_KEY'),
  endpoint: (process.env.SOURCE_ENDPOINT || 'https://storage.bunnycdn.com').replace(/\/$/, ''),
};

const target = {
  zone: requireEnv('TARGET_ZONE'),
  region: process.env.TARGET_REGION || 'de',
};

const s3 = new S3Client({
  endpoint: `https://${target.region}-s3.storage.bunnycdn.com`,
  region: target.region,
  forcePathStyle: true,
  credentials: { accessKeyId: target.zone, secretAccessKey: requireEnv('TARGET_API_KEY') },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

/** An HTTP failure retrying cannot fix — bad credentials, a missing key. */
class PermanentError extends Error {}

const httpError = (label: string, status: number, body = '') => {
  const message = `${label}: HTTP ${status} ${body}`.trim();
  return status >= 400 && status < 500 && status !== 429
    ? new PermanentError(message)
    : new Error(message);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.$metadata?.httpStatusCode;
      const isPermanent =
        err instanceof PermanentError || (status >= 400 && status < 500 && status !== 429);

      if (isPermanent || attempt >= MAX_ATTEMPTS) {
        throw err;
      }

      const delay = 500 * 2 ** attempt;
      console.warn(`  retry ${attempt}/${MAX_ATTEMPTS - 1} ${label} in ${delay}ms: ${err.message}`);
      await sleep(delay);
    }
  }
};

const sourceUrl = (path: string) =>
  `${source.endpoint}/${source.zone}/${path.split('/').map(encodeURIComponent).join('/')}`;

/** Breadth-first walk of the source zone; directories are listed with a trailing slash. */
const listSource = async (prefix: string): Promise<SourceObject[]> => {
  const objects: SourceObject[] = [];
  const queue = [prefix.replace(/^\/+/, '').replace(/\/?$/, '/').replace(/^\/$/, '')];

  while (queue.length) {
    const dir = queue.shift();

    const items = await withRetry(`list ${dir || '/'}`, async () => {
      const response = await fetch(sourceUrl(dir), {
        headers: { AccessKey: source.apiKey, Accept: 'application/json' },
      });

      if (!response.ok) {
        throw httpError('list', response.status, await response.text());
      }

      return (await response.json()) as BunnyListItem[];
    });

    for (const item of items) {
      const key = `${dir}${item.ObjectName}`;

      if (item.IsDirectory) {
        queue.push(`${key}/`);
        continue;
      }

      objects.push({
        key,
        size: item.Length,
        contentType: item.ContentType || undefined,
        sha256Hex: item.Checksum || undefined,
      });
    }

    process.stdout.write(`\rlisted ${objects.length} objects`);
  }

  process.stdout.write('\n');

  return objects;
};

/** Target size, or `null` when the key is absent. */
const headTarget = async (key: string): Promise<number | null> => {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: target.zone, Key: key }));
    return head.ContentLength ?? null;
  } catch (err) {
    if (err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404) {
      return null;
    }

    throw err;
  }
};

const copyObject = async (object: SourceObject): Promise<void> => {
  const response = await fetch(sourceUrl(object.key), { headers: { AccessKey: source.apiKey } });

  if (!response.ok || !response.body) {
    throw httpError('source GET', response.status);
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: target.zone,
      Key: object.key,
      Body: Readable.fromWeb(response.body as ReadableStream),
      ContentLength: object.size,
      ContentType: object.contentType,
      // Bunny verifies the body against it, so a truncated transfer fails instead of landing.
      ChecksumSHA256: object.sha256Hex
        ? Buffer.from(object.sha256Hex, 'hex').toString('base64')
        : undefined,
    }),
  );
};

const processObject = async (object: SourceObject): Promise<Outcome> => {
  const targetSize = await withRetry(`head ${object.key}`, () => headTarget(object.key));

  if (flags['verify-only']) {
    if (targetSize === null) return 'missing';
    return targetSize === object.size ? 'ok' : 'mismatch';
  }

  if (targetSize === object.size) {
    return 'skipped';
  }

  if (flags['dry-run']) {
    return 'pending';
  }

  await withRetry(`copy ${object.key}`, () => copyObject(object));

  return 'copied';
};

const run = async () => {
  const concurrency = Math.max(1, Number(flags.concurrency) || 8);
  const mode = flags['verify-only'] ? 'verify' : flags['dry-run'] ? 'dry-run' : 'copy';

  console.log(`${mode}: ${source.zone}/${flags.prefix} → s3://${target.zone} (${target.region})`);

  const objects = await listSource(flags.prefix);
  const counts: Partial<Record<Outcome, number>> = {};
  const problems: { key: string; outcome: Outcome; error?: string }[] = [];
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    while (cursor < objects.length) {
      const object = objects[cursor++];
      let outcome: Outcome;
      let error: string | undefined;

      try {
        outcome = await processObject(object);
      } catch (err) {
        outcome = 'failed';
        error = err.message;
      }

      counts[outcome] = (counts[outcome] ?? 0) + 1;

      if (['failed', 'missing', 'mismatch', 'pending'].includes(outcome)) {
        problems.push({ key: object.key, outcome, error });
      }

      process.stdout.write(`\r${++done}/${objects.length} ${JSON.stringify(counts)}`);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  process.stdout.write('\n');

  if (problems.length) {
    const reportPath = `copy-storage-zone.${mode}.json`;
    writeFileSync(reportPath, JSON.stringify(problems, null, 2));
    console.log(`${problems.length} keys need attention → ${reportPath}`);
  }

  const unhealthy = (counts.failed ?? 0) + (counts.missing ?? 0) + (counts.mismatch ?? 0);
  process.exitCode = unhealthy ? 1 : 0;
};

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
