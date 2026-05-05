import { describe, it, expect } from 'vitest';
import { mapS3Error, maskAccessKey } from '../s3-client.js';
import { AppError, NotFoundError } from '../errors.js';

function s3Err(name: string, opts: { message?: string; httpStatusCode?: number } = {}): Error {
  const err = new Error(opts.message ?? name);
  Object.assign(err, {
    name,
    $metadata: opts.httpStatusCode !== undefined ? { httpStatusCode: opts.httpStatusCode } : {},
  });
  return err;
}

describe('mapS3Error', () => {
  it('NoSuchBucket → NotFoundError', () => {
    const mapped = mapS3Error(s3Err('NoSuchBucket', { httpStatusCode: 404 }));
    expect(mapped).toBeInstanceOf(NotFoundError);
  });

  it('NoSuchKey → NotFoundError', () => {
    const mapped = mapS3Error(s3Err('NoSuchKey', { httpStatusCode: 404 }));
    expect(mapped).toBeInstanceOf(NotFoundError);
  });

  it('NoSuchBucketPolicy → NotFoundError (so route turns it into policy: null)', () => {
    const mapped = mapS3Error(s3Err('NoSuchBucketPolicy'));
    expect(mapped).toBeInstanceOf(NotFoundError);
  });

  it('AccessDenied → s3.access_denied 403', () => {
    const mapped = mapS3Error(s3Err('AccessDenied', { httpStatusCode: 403 }));
    expect(mapped).toMatchObject({ code: 's3.access_denied', statusCode: 403 });
  });

  it('InvalidAccessKeyId → s3.invalid_credentials 401', () => {
    const mapped = mapS3Error(s3Err('InvalidAccessKeyId', { message: 'bad key' }));
    expect(mapped).toMatchObject({ code: 's3.invalid_credentials', statusCode: 401 });
  });

  it('SignatureDoesNotMatch → s3.invalid_credentials 401', () => {
    const mapped = mapS3Error(s3Err('SignatureDoesNotMatch'));
    expect(mapped).toMatchObject({ code: 's3.invalid_credentials', statusCode: 401 });
  });

  it('BucketAlreadyOwnedByYou → s3.bucket_exists 409', () => {
    const mapped = mapS3Error(s3Err('BucketAlreadyOwnedByYou'));
    expect(mapped).toMatchObject({ code: 's3.bucket_exists', statusCode: 409 });
  });

  it('BucketNotEmpty → s3.bucket_not_empty 409', () => {
    const mapped = mapS3Error(s3Err('BucketNotEmpty'));
    expect(mapped).toMatchObject({ code: 's3.bucket_not_empty', statusCode: 409 });
  });

  it('InvalidBucketName → s3.invalid_bucket_name 400', () => {
    const mapped = mapS3Error(s3Err('InvalidBucketName', { message: 'too short' }));
    expect(mapped).toMatchObject({ code: 's3.invalid_bucket_name', statusCode: 400 });
  });

  it('MalformedPolicy → s3.invalid_policy 400', () => {
    const mapped = mapS3Error(s3Err('MalformedPolicy'));
    expect(mapped).toMatchObject({ code: 's3.invalid_policy', statusCode: 400 });
  });

  it('connection refused (no httpStatusCode) → s3.unreachable 503', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:9000');
    const mapped = mapS3Error(err);
    expect(mapped).toMatchObject({ code: 's3.unreachable', statusCode: 503 });
  });

  it('DNS not-found → s3.unreachable 503', () => {
    const err = new Error('getaddrinfo ENOTFOUND minio');
    const mapped = mapS3Error(err);
    expect(mapped).toMatchObject({ code: 's3.unreachable', statusCode: 503 });
  });

  it('passes AppError through unchanged', () => {
    const original = new AppError('custom', 'kept', 418);
    const mapped = mapS3Error(original);
    expect(mapped).toBe(original);
  });

  it('falls back to s3.upstream_error for unknown SDK errors', () => {
    const mapped = mapS3Error(s3Err('SomeFutureCode', { httpStatusCode: 500 }));
    expect(mapped).toMatchObject({ code: 's3.upstream_error', statusCode: 500 });
  });

  it('clamps weird status codes to 502', () => {
    const mapped = mapS3Error(s3Err('Weird', { httpStatusCode: 999 }));
    expect(mapped).toMatchObject({ code: 's3.upstream_error', statusCode: 502 });
  });
});

describe('maskAccessKey', () => {
  it('keeps the first 4 and last 4 of a long key', () => {
    expect(maskAccessKey('AKIAEXAMPLE123456789')).toBe('AKIA••••••6789');
  });

  it('falls back to a heavy mask for short values', () => {
    expect(maskAccessKey('shortk')).toBe('•••••k');
  });
});
