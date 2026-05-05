import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { AppError, NotFoundError } from './errors.js';

/**
 * Connection-level config used to build an S3Client. Decoupled from our
 * Prisma row so tests can pass plain values.
 */
export interface S3ConnectionConfig {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  pathStyle: boolean;
}

/**
 * Build an S3Client for a given connection. MinIO and most self-hosted
 * endpoints require `forcePathStyle: true`. AWS itself supports either
 * mode but defaults to virtual-hosted in v3.
 */
export function createS3Client(config: S3ConnectionConfig): S3Client {
  const opts: S3ClientConfig = {
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: config.pathStyle,
  };
  return new S3Client(opts);
}

interface S3ErrorLike {
  name?: string;
  message?: string;
  Code?: string;
  $metadata?: { httpStatusCode?: number };
}

/**
 * Translate an AWS SDK error into our AppError taxonomy. Done here so the
 * service layer doesn't repeat the same instanceOf / shape-checking dance.
 *
 * Common S3 error names: NoSuchBucket, NoSuchKey, AccessDenied,
 * InvalidAccessKeyId, SignatureDoesNotMatch, BucketAlreadyOwnedByYou,
 * BucketAlreadyExists, BucketNotEmpty, NoSuchBucketPolicy.
 */
export function mapS3Error(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const e = (err ?? {}) as S3ErrorLike;
  const status = e.$metadata?.httpStatusCode;
  const name = e.name ?? e.Code ?? '';
  const message = e.message ?? 'S3 request failed';

  // ── Specific name-based mappings (these win over status fallbacks) ──
  if (name === 'NoSuchBucket' || name === 'NoSuchKey') {
    return new NotFoundError(message);
  }
  if (name === 'NoSuchBucketPolicy') {
    // Treat "no policy set" as not-found — the routes turn that into `policy: null`.
    return new NotFoundError('No bucket policy set');
  }
  if (name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch') {
    return new AppError(
      's3.invalid_credentials',
      'S3 credentials rejected by the server',
      401,
    );
  }
  if (name === 'AccessDenied') {
    return new AppError('s3.access_denied', message, 403);
  }
  if (name === 'BucketAlreadyOwnedByYou' || name === 'BucketAlreadyExists') {
    return new AppError('s3.bucket_exists', 'A bucket with that name already exists', 409);
  }
  if (name === 'BucketNotEmpty') {
    return new AppError(
      's3.bucket_not_empty',
      'Bucket is not empty — delete its objects first',
      409,
    );
  }
  if (name === 'InvalidBucketName') {
    return new AppError('s3.invalid_bucket_name', message, 400);
  }
  if (name === 'MalformedPolicy' || name === 'InvalidPolicyDocument') {
    return new AppError('s3.invalid_policy', message, 400);
  }
  // ── Status-based fallbacks for unknown error names ──
  if (status === 404) {
    return new NotFoundError(message);
  }
  if (status === 403) {
    return new AppError('s3.access_denied', message, 403);
  }
  // Connection-level errors (DNS, refused, timeout) typically have no name;
  // SDK wraps them as Error.
  if (status === undefined && (e.message?.includes('ECONN') || e.message?.includes('ENOTFOUND'))) {
    return new AppError('s3.unreachable', `Cannot reach S3 endpoint: ${e.message}`, 503);
  }
  const httpCode = typeof status === 'number' && status >= 400 && status < 600 ? status : 502;
  return new AppError('s3.upstream_error', message, httpCode);
}

/**
 * Mask the access key for display ("AKIA••••••WXYZ"). The secret key is
 * encrypted at rest and never returned over the API at all — this is only
 * for the access-key prefix shown in the UI.
 */
export function maskAccessKey(value: string): string {
  if (value.length <= 8) return `${'•'.repeat(Math.max(value.length - 1, 1))}${value.slice(-1)}`;
  return `${value.slice(0, 4)}${'•'.repeat(6)}${value.slice(-4)}`;
}
