import type { PrismaClient } from '@prisma/client';
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
  DeleteBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CryptoBox } from '../lib/crypto-box.js';
import {
  createS3Client,
  mapS3Error,
  maskAccessKey,
  type S3ConnectionConfig,
} from '../lib/s3-client.js';
import { AppError, NotFoundError } from '../lib/errors.js';

/** Format verify-step errors so the lastError column carries the AppError code. */
function formatVerifyError(err: unknown): string {
  if (err instanceof AppError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return 'Verification failed';
}

// -------------------- Public types --------------------

export type S3Flavor = 'auto' | 'minio' | 'aws' | 'other';

export interface S3ConnectionSummary {
  id: string;
  name: string;
  endpoint: string;
  region: string;
  flavor: S3Flavor;
  pathStyle: boolean;
  accessKeyMask: string;
  verified: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateS3ConnectionInput {
  name: string;
  endpoint: string;
  region?: string;
  flavor?: S3Flavor;
  pathStyle?: boolean;
  accessKey: string;
  secretKey: string;
}

export interface UpdateS3ConnectionInput {
  name?: string;
  endpoint?: string;
  region?: string;
  flavor?: S3Flavor;
  pathStyle?: boolean;
  accessKey?: string;
  secretKey?: string;
}

export interface BucketSummary {
  name: string;
  createdAt: string | null;
}

export interface S3ObjectEntry {
  key: string;
  size: number;
  lastModified: string | null;
  etag: string | null;
  storageClass: string | null;
}

export interface ListObjectsResult {
  bucket: string;
  prefix: string;
  delimiter: string;
  /** Common-prefixes — i.e. "folders" — when delimiter is `/`. */
  prefixes: string[];
  objects: S3ObjectEntry[];
  isTruncated: boolean;
  continuationToken: string | null;
  nextContinuationToken: string | null;
  keyCount: number;
}

export interface PresignedUrl {
  url: string;
  expiresIn: number;
  method: 'GET' | 'PUT';
}

// -------------------- DI / options --------------------

export interface StorageServiceOptions {
  /** Override for tests — skip real S3Client construction. */
  buildS3Client?: (config: S3ConnectionConfig) => S3Client;
  /** Override for tests — skip real presigner. */
  presigner?: (
    client: S3Client,
    command: GetObjectCommand | PutObjectCommand,
    opts: { expiresIn: number },
  ) => Promise<string>;
  /**
   * Default expiry for presigned URLs in seconds (max 7 days per AWS).
   * Defaults to 1 hour.
   */
  presignExpirySeconds?: number;
}

const DEFAULT_PRESIGN_EXPIRY = 60 * 60; // 1 hour

// -------------------- Service --------------------

export class StorageService {
  private readonly buildClient: (config: S3ConnectionConfig) => S3Client;
  private readonly presigner: NonNullable<StorageServiceOptions['presigner']>;
  private readonly presignExpiry: number;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cryptoBox: CryptoBox,
    options: StorageServiceOptions = {},
  ) {
    this.buildClient = options.buildS3Client ?? createS3Client;
    this.presigner =
      options.presigner ??
      ((client, command, opts) =>
        getSignedUrl(client, command as Parameters<typeof getSignedUrl>[1], opts));
    this.presignExpiry = options.presignExpirySeconds ?? DEFAULT_PRESIGN_EXPIRY;
  }

  // -------------------- Connections --------------------

  async listConnections(): Promise<S3ConnectionSummary[]> {
    const rows = await this.prisma.s3Connection.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toSummary(r));
  }

  async getConnection(id: string): Promise<S3ConnectionSummary> {
    const row = await this.prisma.s3Connection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Connection not found');
    return this.toSummary(row);
  }

  async createConnection(input: CreateS3ConnectionInput): Promise<S3ConnectionSummary> {
    const existing = await this.prisma.s3Connection.findUnique({ where: { name: input.name } });
    if (existing) throw new AppError('storage.duplicate_name', 'A connection with that name already exists', 409);

    const cipher = this.cryptoBox.seal(input.secretKey);
    let verified = false;
    let lastVerifiedAt: Date | null = null;
    let lastError: string | null = null;
    try {
      await this.runVerify({
        endpoint: input.endpoint,
        region: input.region ?? 'us-east-1',
        accessKey: input.accessKey,
        secretKey: input.secretKey,
        pathStyle: input.pathStyle ?? true,
      });
      verified = true;
      lastVerifiedAt = new Date();
    } catch (err) {
      lastError = formatVerifyError(err);
    }

    const created = await this.prisma.s3Connection.create({
      data: {
        name: input.name,
        endpoint: input.endpoint,
        region: input.region ?? 'us-east-1',
        flavor: input.flavor ?? 'auto',
        pathStyle: input.pathStyle ?? true,
        accessKey: input.accessKey,
        secretKeyCipher: cipher,
        verified,
        lastVerifiedAt,
        lastError,
      },
    });
    return this.toSummary(created);
  }

  async updateConnection(id: string, input: UpdateS3ConnectionInput): Promise<S3ConnectionSummary> {
    const row = await this.prisma.s3Connection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Connection not found');
    if (input.name && input.name !== row.name) {
      const dup = await this.prisma.s3Connection.findUnique({ where: { name: input.name } });
      if (dup) throw new AppError('storage.duplicate_name', 'A connection with that name already exists', 409);
    }
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data['name'] = input.name;
    if (input.endpoint !== undefined) data['endpoint'] = input.endpoint;
    if (input.region !== undefined) data['region'] = input.region;
    if (input.flavor !== undefined) data['flavor'] = input.flavor;
    if (input.pathStyle !== undefined) data['pathStyle'] = input.pathStyle;
    if (input.accessKey !== undefined) data['accessKey'] = input.accessKey;
    if (input.secretKey !== undefined) data['secretKeyCipher'] = this.cryptoBox.seal(input.secretKey);
    // Touching credentials invalidates verification.
    if (input.accessKey !== undefined || input.secretKey !== undefined || input.endpoint !== undefined) {
      data['verified'] = false;
      data['lastVerifiedAt'] = null;
    }
    const updated = await this.prisma.s3Connection.update({ where: { id }, data });
    return this.toSummary(updated);
  }

  async deleteConnection(id: string): Promise<void> {
    const row = await this.prisma.s3Connection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Connection not found');
    await this.prisma.s3Connection.delete({ where: { id } });
  }

  async verifyConnection(id: string): Promise<S3ConnectionSummary> {
    const row = await this.prisma.s3Connection.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Connection not found');
    let verified = false;
    let lastError: string | null = null;
    try {
      await this.runVerify({
        endpoint: row.endpoint,
        region: row.region,
        accessKey: row.accessKey,
        secretKey: this.cryptoBox.open(row.secretKeyCipher),
        pathStyle: row.pathStyle,
      });
      verified = true;
    } catch (err) {
      lastError = formatVerifyError(err);
    }
    const updated = await this.prisma.s3Connection.update({
      where: { id },
      data: {
        verified,
        lastVerifiedAt: verified ? new Date() : row.lastVerifiedAt,
        lastError,
      },
    });
    return this.toSummary(updated);
  }

  // -------------------- Buckets --------------------

  async listBuckets(connectionId: string): Promise<BucketSummary[]> {
    const client = await this.clientFor(connectionId);
    try {
      const out = await client.send(new ListBucketsCommand({}));
      return (out.Buckets ?? []).map((b) => ({
        name: b.Name ?? '',
        createdAt: b.CreationDate ? b.CreationDate.toISOString() : null,
      }));
    } catch (err) {
      throw mapS3Error(err);
    }
  }

  async createBucket(connectionId: string, name: string): Promise<BucketSummary> {
    const client = await this.clientFor(connectionId);
    try {
      await client.send(new CreateBucketCommand({ Bucket: name }));
    } catch (err) {
      throw mapS3Error(err);
    }
    return { name, createdAt: new Date().toISOString() };
  }

  async deleteBucket(connectionId: string, name: string): Promise<void> {
    const client = await this.clientFor(connectionId);
    try {
      await client.send(new DeleteBucketCommand({ Bucket: name }));
    } catch (err) {
      throw mapS3Error(err);
    }
  }

  async headBucket(connectionId: string, name: string): Promise<{ exists: boolean }> {
    const client = await this.clientFor(connectionId);
    try {
      await client.send(new HeadBucketCommand({ Bucket: name }));
      return { exists: true };
    } catch (err) {
      const mapped = mapS3Error(err);
      if (mapped instanceof NotFoundError) return { exists: false };
      throw mapped;
    }
  }

  // -------------------- Objects --------------------

  async listObjects(
    connectionId: string,
    bucket: string,
    opts: {
      prefix?: string;
      delimiter?: string;
      continuationToken?: string;
      maxKeys?: number;
    } = {},
  ): Promise<ListObjectsResult> {
    const client = await this.clientFor(connectionId);
    const prefix = opts.prefix ?? '';
    const delimiter = opts.delimiter ?? '/';
    try {
      const out = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: delimiter,
          MaxKeys: Math.min(Math.max(opts.maxKeys ?? 200, 1), 1000),
          ...(opts.continuationToken ? { ContinuationToken: opts.continuationToken } : {}),
        }),
      );
      return {
        bucket,
        prefix,
        delimiter,
        prefixes: (out.CommonPrefixes ?? [])
          .map((p) => p.Prefix ?? '')
          .filter((s) => s.length > 0),
        objects: (out.Contents ?? []).map((o) => ({
          key: o.Key ?? '',
          size: o.Size ?? 0,
          lastModified: o.LastModified ? o.LastModified.toISOString() : null,
          etag: o.ETag ?? null,
          storageClass: o.StorageClass ?? null,
        })),
        isTruncated: out.IsTruncated ?? false,
        continuationToken: opts.continuationToken ?? null,
        nextContinuationToken: out.NextContinuationToken ?? null,
        keyCount: out.KeyCount ?? 0,
      };
    } catch (err) {
      throw mapS3Error(err);
    }
  }

  async deleteObject(connectionId: string, bucket: string, key: string): Promise<void> {
    const client = await this.clientFor(connectionId);
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
      throw mapS3Error(err);
    }
  }

  async getDownloadUrl(connectionId: string, bucket: string, key: string): Promise<PresignedUrl> {
    const client = await this.clientFor(connectionId);
    try {
      const url = await this.presigner(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: this.presignExpiry },
      );
      return { url, expiresIn: this.presignExpiry, method: 'GET' };
    } catch (err) {
      throw mapS3Error(err);
    }
  }

  async getUploadUrl(
    connectionId: string,
    bucket: string,
    key: string,
    opts: { contentType?: string } = {},
  ): Promise<PresignedUrl> {
    const client = await this.clientFor(connectionId);
    try {
      const url = await this.presigner(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ...(opts.contentType ? { ContentType: opts.contentType } : {}),
        }),
        { expiresIn: this.presignExpiry },
      );
      return { url, expiresIn: this.presignExpiry, method: 'PUT' };
    } catch (err) {
      throw mapS3Error(err);
    }
  }

  /**
   * Server-side object upload (used by backups). The body is sent in one
   * request, so this is suited to objects up to a few GB; very large dumps
   * would want multipart streaming (a future enhancement).
   */
  async putObject(
    connectionId: string,
    bucket: string,
    key: string,
    body: Buffer | Uint8Array,
    opts: { contentType?: string } = {},
  ): Promise<void> {
    const client = await this.clientFor(connectionId);
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ...(opts.contentType ? { ContentType: opts.contentType } : {}),
        }),
      );
    } catch (err) {
      throw mapS3Error(err);
    }
  }

  /** Server-side object fetch into memory (used by restore). */
  async getObjectBytes(connectionId: string, bucket: string, key: string): Promise<Buffer> {
    const client = await this.clientFor(connectionId);
    try {
      const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const body = out.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
      if (!body?.transformToByteArray) {
        throw new AppError('storage.read_failed', 'Object body could not be read', 502);
      }
      return Buffer.from(await body.transformToByteArray());
    } catch (err) {
      throw mapS3Error(err);
    }
  }

  // -------------------- Bucket policy --------------------

  /** Returns null if no policy is set (rather than throwing 404). */
  async getBucketPolicy(connectionId: string, bucket: string): Promise<{ policy: string | null }> {
    const client = await this.clientFor(connectionId);
    try {
      const out = await client.send(new GetBucketPolicyCommand({ Bucket: bucket }));
      return { policy: out.Policy ?? null };
    } catch (err) {
      const mapped = mapS3Error(err);
      if (mapped instanceof NotFoundError) return { policy: null };
      throw mapped;
    }
  }

  async putBucketPolicy(connectionId: string, bucket: string, policy: string): Promise<void> {
    // Cheap sanity check before round-tripping to S3 — surface JSON parse
    // errors with our `validation_error` code, not s3.invalid_policy.
    try {
      JSON.parse(policy);
    } catch {
      throw new AppError('storage.invalid_json', 'Policy must be valid JSON', 400);
    }
    const client = await this.clientFor(connectionId);
    try {
      await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }));
    } catch (err) {
      throw mapS3Error(err);
    }
  }

  async deleteBucketPolicy(connectionId: string, bucket: string): Promise<void> {
    const client = await this.clientFor(connectionId);
    try {
      await client.send(new DeleteBucketPolicyCommand({ Bucket: bucket }));
    } catch (err) {
      throw mapS3Error(err);
    }
  }

  // -------------------- Helpers --------------------

  private async clientFor(connectionId: string): Promise<S3Client> {
    const row = await this.prisma.s3Connection.findUnique({ where: { id: connectionId } });
    if (!row) throw new NotFoundError('Connection not found');
    return this.buildClient({
      endpoint: row.endpoint,
      region: row.region,
      accessKey: row.accessKey,
      secretKey: this.cryptoBox.open(row.secretKeyCipher),
      pathStyle: row.pathStyle,
    });
  }

  private async runVerify(config: S3ConnectionConfig): Promise<void> {
    const client = this.buildClient(config);
    try {
      await client.send(new ListBucketsCommand({}));
    } catch (err) {
      throw mapS3Error(err);
    }
  }

  private toSummary(row: {
    id: string;
    name: string;
    endpoint: string;
    region: string;
    flavor: string;
    pathStyle: boolean;
    accessKey: string;
    verified: boolean;
    lastVerifiedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): S3ConnectionSummary {
    return {
      id: row.id,
      name: row.name,
      endpoint: row.endpoint,
      region: row.region,
      flavor: row.flavor as S3Flavor,
      pathStyle: row.pathStyle,
      accessKeyMask: maskAccessKey(row.accessKey),
      verified: row.verified,
      lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
      lastError: row.lastError,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
