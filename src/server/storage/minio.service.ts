/**
 * MinIO Storage Service
 * 
 * Provides S3-compatible object storage management through MinIO.
 * Handles bucket operations and access key management.
 */

import * as Minio from 'minio';
import { getConfig } from '@/server/config';
import aws4 from 'aws4';
import axios from 'axios';

// Types for bucket operations
export interface BucketInfo {
    name: string;
    creationDate?: Date;
}

export interface BucketDetails extends BucketInfo {
    objectCount?: number;
    totalSize?: number;
    policy?: string;
}

export interface CreateBucketOptions {
    name: string;
    region?: string;
}

// Types for access key operations
export interface AccessKeyInfo {
    accessKey: string;
    secretKey?: string; // Only returned on creation
    description?: string;
    createdAt?: Date;
    status?: 'enabled' | 'disabled';
}

export interface CreateAccessKeyInput {
    description?: string;
}

// Types for object listing
export interface ObjectInfo {
    name: string;
    size: number;
    etag?: string;
    lastModified?: Date;
    prefix?: string;
    isDir?: boolean;
}

export interface ListObjectsOptions {
    bucket: string;
    prefix?: string;
    recursive?: boolean;
    maxKeys?: number;
}

// Connection status
export interface MinioConnectionStatus {
    connected: boolean;
    endpoint: string;
    port: number;
    useSSL: boolean;
    consoleUrl?: string;
    error?: string;
}

/**
 * Get MinIO client instance
 */
function getMinioClient(): Minio.Client {
    const config = getConfig();

    return new Minio.Client({
        endPoint: config.minio.endpoint,
        port: config.minio.port,
        useSSL: config.minio.useSSL,
        accessKey: config.minio.accessKey,
        secretKey: config.minio.secretKey,
    });
}

/**
 * Make authenticated request to MinIO Admin API
 * Uses AWS Signature V4 for authentication
 */
async function makeAdminRequest(
    method: string,
    path: string,
    body?: any
): Promise<any> {
    const config = getConfig();
    const protocol = config.minio.useSSL ? 'https' : 'http';
    const host = `${config.minio.endpoint}:${config.minio.port}`;

    const requestOptions: aws4.Request = {
        host: `${config.minio.endpoint}:${config.minio.port}`,
        method,
        path,
        service: 's3',
        region: 'us-east-1',
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (body) {
        requestOptions.body = JSON.stringify(body);
        requestOptions.headers!['Content-Length'] = Buffer.byteLength(requestOptions.body).toString();
    }

    // Sign the request with AWS Signature V4
    const signedRequest = aws4.sign(requestOptions, {
        accessKeyId: config.minio.accessKey,
        secretAccessKey: config.minio.secretKey,
    });

    // Make the HTTP request
    const url = `${protocol}://${host}${path}`;
    const response = await axios({
        method,
        url,
        headers: signedRequest.headers as any, // Convert OutgoingHttpHeaders to axios headers
        data: body,
        validateStatus: () => true, // Don't throw on any status
    });

    if (response.status >= 400) {
        throw new Error(`MinIO Admin API error: ${response.statusText} - ${JSON.stringify(response.data)}`);
    }

    return response.data;
}

/**
 * Test connection to MinIO server
 */
export async function testConnection(): Promise<MinioConnectionStatus> {
    const config = getConfig();

    try {
        const client = getMinioClient();
        // List buckets to verify connection
        await client.listBuckets();

        const consolePort = config.minio.console?.port || 9001;
        const protocol = config.minio.useSSL ? 'https' : 'http';

        return {
            connected: true,
            endpoint: config.minio.endpoint,
            port: config.minio.port,
            useSSL: config.minio.useSSL,
            consoleUrl: `${protocol}://${config.minio.endpoint}:${consolePort}`,
        };
    } catch (error) {
        return {
            connected: false,
            endpoint: config.minio.endpoint,
            port: config.minio.port,
            useSSL: config.minio.useSSL,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * List all buckets
 */
export async function listBuckets(): Promise<BucketInfo[]> {
    const client = getMinioClient();
    const buckets = await client.listBuckets();

    return buckets.map(bucket => ({
        name: bucket.name,
        creationDate: bucket.creationDate,
    }));
}

/**
 * Get detailed bucket information
 */
export async function getBucketDetails(name: string): Promise<BucketDetails | null> {
    const client = getMinioClient();

    // Check if bucket exists
    const exists = await client.bucketExists(name);
    if (!exists) {
        return null;
    }

    // Get bucket info
    const buckets = await client.listBuckets();
    const bucket = buckets.find(b => b.name === name);

    if (!bucket) {
        return null;
    }

    // Get policy if set
    let policy: string | undefined;
    try {
        policy = await client.getBucketPolicy(name);
    } catch {
        // Policy might not be set
        policy = undefined;
    }

    // Count objects and total size
    let objectCount = 0;
    let totalSize = 0;

    try {
        const stream = client.listObjects(name, '', true);
        for await (const obj of stream) {
            objectCount++;
            totalSize += obj.size || 0;
        }
    } catch {
        // Ignore errors in counting
    }

    return {
        name: bucket.name,
        creationDate: bucket.creationDate,
        objectCount,
        totalSize,
        policy,
    };
}

/**
 * Create a new bucket
 */
export async function createBucket(options: CreateBucketOptions): Promise<BucketInfo> {
    const client = getMinioClient();

    // Validate bucket name (S3 naming rules)
    const nameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
    if (!nameRegex.test(options.name)) {
        throw new Error(
            'Invalid bucket name. Must be 3-63 characters, lowercase, ' +
            'start and end with letter/number, and can contain dots and hyphens.'
        );
    }

    await client.makeBucket(options.name, options.region || '');

    return {
        name: options.name,
        creationDate: new Date(),
    };
}

/**
 * Delete a bucket (must be empty)
 */
export async function deleteBucket(name: string): Promise<void> {
    const client = getMinioClient();

    // Check if bucket exists
    const exists = await client.bucketExists(name);
    if (!exists) {
        throw new Error(`Bucket '${name}' does not exist`);
    }

    // Check if bucket is empty
    const stream = client.listObjects(name, '', true);
    for await (const _ of stream) {
        throw new Error(`Bucket '${name}' is not empty. Delete all objects first.`);
    }

    await client.removeBucket(name);
}

/**
 * Get bucket policy
 */
export async function getBucketPolicy(name: string): Promise<string | null> {
    const client = getMinioClient();

    try {
        return await client.getBucketPolicy(name);
    } catch {
        return null;
    }
}

/**
 * Set bucket policy
 */
export async function setBucketPolicy(name: string, policy: string): Promise<void> {
    const client = getMinioClient();
    await client.setBucketPolicy(name, policy);
}

/**
 * List objects in a bucket
 */
export async function listObjects(options: ListObjectsOptions): Promise<ObjectInfo[]> {
    const client = getMinioClient();
    const objects: ObjectInfo[] = [];

    const stream = client.listObjects(
        options.bucket,
        options.prefix || '',
        options.recursive ?? false
    );

    let count = 0;
    const maxKeys = options.maxKeys || 1000;

    for await (const obj of stream) {
        if (count >= maxKeys) break;

        objects.push({
            name: obj.name,
            size: obj.size,
            etag: obj.etag,
            lastModified: obj.lastModified,
            prefix: obj.prefix,
            isDir: obj.prefix ? true : false,
        });

        count++;
    }

    return objects;
}

/**
 * Get S3-compatible endpoint URL for client configuration
 */
export function getS3EndpointInfo(): {
    endpoint: string;
    region: string;
    forcePathStyle: boolean;
    exampleAwsCli: string;
    exampleNodejs: string;
    examplePython: string;
} {
    const config = getConfig();
    const protocol = config.minio.useSSL ? 'https' : 'http';
    const endpoint = `${protocol}://${config.minio.endpoint}:${config.minio.port}`;

    return {
        endpoint,
        region: 'us-east-1', // MinIO default region
        forcePathStyle: true,
        exampleAwsCli: `aws configure set aws_access_key_id YOUR_ACCESS_KEY
aws configure set aws_secret_access_key YOUR_SECRET_KEY
aws configure set default.region us-east-1

# Use the endpoint for all commands:
aws --endpoint-url ${endpoint} s3 ls
aws --endpoint-url ${endpoint} s3 mb s3://my-bucket
aws --endpoint-url ${endpoint} s3 cp myfile.txt s3://my-bucket/`,
        exampleNodejs: `import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: '${endpoint}',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: 'YOUR_ACCESS_KEY',
    secretAccessKey: 'YOUR_SECRET_KEY',
  },
});

const buckets = await s3Client.send(new ListBucketsCommand({}));
console.log(buckets);`,
        examplePython: `import boto3

s3 = boto3.client(
    's3',
    endpoint_url='${endpoint}',
    aws_access_key_id='YOUR_ACCESS_KEY',
    aws_secret_access_key='YOUR_SECRET_KEY',
    region_name='us-east-1',
)

# List buckets
response = s3.list_buckets()
for bucket in response['Buckets']:
    print(bucket['Name'])`,
    };
}

/**
 * Get MinIO enabled status from config
 */
export function isMinioEnabled(): boolean {
    try {
        const config = getConfig();
        return config.minio?.enabled ?? false;
    } catch {
        return false;
    }
}

/**
 * Upload a file to a bucket
 */
export async function uploadObject(
    bucket: string,
    objectName: string,
    data: Buffer,
    size?: number,
    contentType?: string
): Promise<{ etag: string; versionId?: string }> {
    const client = getMinioClient();

    const metaData = contentType ? { 'Content-Type': contentType } : {};

    const result = await client.putObject(bucket, objectName, data, size, metaData);

    return {
        etag: result.etag,
        versionId: result.versionId,
    };
}

/**
 * Create a folder (empty object with trailing /)
 */
export async function createFolder(bucket: string, folderPath: string): Promise<void> {
    const client = getMinioClient();

    // Ensure folder path ends with /
    const normalizedPath = folderPath.endsWith('/') ? folderPath : folderPath + '/';

    // Create empty object to represent folder
    await client.putObject(bucket, normalizedPath, Buffer.from(''), 0);
}

/**
 * Delete an object from a bucket
 */
export async function deleteObject(bucket: string, objectName: string): Promise<void> {
    const client = getMinioClient();
    await client.removeObject(bucket, objectName);
}

/**
 * Delete multiple objects from a bucket
 */
export async function deleteObjects(bucket: string, objectNames: string[]): Promise<void> {
    const client = getMinioClient();
    await client.removeObjects(bucket, objectNames);
}

/**
 * Get a presigned URL for downloading an object
 */
export async function getPresignedDownloadUrl(
    bucket: string,
    objectName: string,
    expirySeconds: number = 3600
): Promise<string> {
    const client = getMinioClient();
    return await client.presignedGetObject(bucket, objectName, expirySeconds);
}

/**
 * Get detailed metadata for an object
 */
export async function getObjectMetadata(
    bucket: string,
    objectName: string
): Promise<{
    size: number;
    etag: string;
    lastModified: Date;
    contentType?: string;
    metadata?: Record<string, string>;
}> {
    const client = getMinioClient();
    const stat = await client.statObject(bucket, objectName);

    return {
        size: stat.size,
        etag: stat.etag,
        lastModified: stat.lastModified,
        contentType: stat.metaData?.['content-type'],
        metadata: stat.metaData,
    };
}

/**
 * Copy an object to a new location
 */
export async function copyObject(
    bucket: string,
    sourcePath: string,
    destinationPath: string
): Promise<{ etag: string }> {
    const client = getMinioClient();

    const conds = new Minio.CopyConditions();
    await client.copyObject(
        bucket,
        destinationPath,
        `/${bucket}/${sourcePath}`,
        conds
    );

    return { etag: '' };
}

/**
 * Move an object to a new location (copy + delete)
 */
export async function moveObject(
    bucket: string,
    sourcePath: string,
    destinationPath: string
): Promise<void> {
    await copyObject(bucket, sourcePath, destinationPath);
    await deleteObject(bucket, sourcePath);
}

/**
 * Move multiple objects to a new location
 */
export async function moveObjects(
    bucket: string,
    sources: string[],
    destinationPrefix: string
): Promise<void> {
    for (const source of sources) {
        const fileName = source.split('/').pop() || source;
        const destination = destinationPrefix + fileName;
        await moveObject(bucket, source, destination);
    }
}

/**
 * Get a presigned URL for uploading an object
 */
export async function getPresignedUploadUrl(
    bucket: string,
    objectName: string,
    expirySeconds: number = 3600
): Promise<string> {
    const client = getMinioClient();
    return await client.presignedPutObject(bucket, objectName, expirySeconds);
}

/**
 * Generate bucket policy from template
 */
export function generateBucketPolicy(
    bucket: string,
    access: 'readonly' | 'readwrite' | 'admin'
): string {
    const bucketArn = `arn:aws:s3:::${bucket}`;
    const objectArn = `arn:aws:s3:::${bucket}/*`;

    const policies = {
        readonly: {
            Version: '2012-10-17',
            Statement: [{
                Effect: 'Allow',
                Action: ['s3:GetObject', 's3:ListBucket'],
                Resource: [bucketArn, objectArn],
            }],
        },
        readwrite: {
            Version: '2012-10-17',
            Statement: [{
                Effect: 'Allow',
                Action: ['s3:*'],
                Resource: [bucketArn, objectArn],
            }],
        },
        admin: {
            Version: '2012-10-17',
            Statement: [{
                Effect: 'Allow',
                Action: ['s3:*'],
                Resource: ['arn:aws:s3:::*'],
            }],
        },
    };

    return JSON.stringify(policies[access], null, 2);
}

/**
 * Set bucket versioning
 */
export async function setBucketVersioning(
    bucket: string,
    enabled: boolean
): Promise<void> {
    const client = getMinioClient();
    const versionConfig = enabled ? 'Enabled' : 'Suspended';
    await client.setBucketVersioning(bucket, { Status: versionConfig } as any);
}

/**
 * Get bucket versioning status
 */
export async function getBucketVersioning(bucket: string): Promise<boolean> {
    const client = getMinioClient();
    try {
        const config = await client.getBucketVersioning(bucket);
        return config?.Status === 'Enabled';
    } catch {
        return false;
    }
}

/**
 * Get bucket tags
 */
export async function getBucketTags(bucket: string): Promise<Record<string, string>> {
    const client = getMinioClient();
    try {
        const tags = await client.getBucketTagging(bucket);
        const tagObj: Record<string, string> = {};
        if (tags && Array.isArray(tags)) {
            tags.forEach((tag: any) => {
                tagObj[tag.Key] = tag.Value;
            });
        }
        return tagObj;
    } catch {
        return {};
    }
}

/**
 * Set bucket tags
 */
export async function setBucketTags(
    bucket: string,
    tags: Record<string, string>
): Promise<void> {
    const client = getMinioClient();
    const tagArray = Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
    await client.setBucketTagging(bucket, tagArray as any);
}

/**
 * Note: MinIO service account management requires admin API access
 * which is not available through the standard minio npm package.
 * Service accounts would need to be managed through MinIO's admin API
 * or mc (MinIO Client) commands.
 * 
 * For now, we'll provide placeholder functions that return appropriate messages.
 * In production, you would integrate with MinIO Admin API or use mc commands.
 */

export interface ServiceAccountInfo {
    accessKey: string;
    description?: string;
    policy?: string;
    createdAt?: Date;
}

export interface ServiceAccountCredentials {
    accessKey: string;
    secretKey: string;
    createdAt: Date;
}

/**
 * List all service accounts
 */
export async function listServiceAccounts(): Promise<ServiceAccountInfo[]> {
    try {
        const response = await makeAdminRequest('GET', '/minio/admin/v3/list-service-accounts');

        // MinIO returns service accounts as an array of access keys
        if (Array.isArray(response)) {
            return response.map((accessKey: string) => ({
                accessKey,
                createdAt: new Date(), // MinIO doesn't provide creation date in list
            }));
        }

        return [];
    } catch (error) {
        console.error('Failed to list service accounts:', error);
        throw new Error('Failed to list service accounts. Ensure MinIO credentials have admin privileges.');
    }
}

/**
 * Create a new service account with optional policy
 */
export async function createServiceAccount(
    name: string,
    policy?: string
): Promise<ServiceAccountCredentials> {
    try {
        const requestBody: any = {};

        if (policy) {
            requestBody.policy = policy;
        }

        if (name) {
            requestBody.name = name;
        }

        const response = await makeAdminRequest('POST', '/minio/admin/v3/add-service-account', requestBody);

        return {
            accessKey: response.accessKey,
            secretKey: response.secretKey,
            createdAt: new Date(),
        };
    } catch (error) {
        console.error('Failed to create service account:', error);
        throw new Error('Failed to create service account. Ensure MinIO credentials have admin privileges.');
    }
}

/**
 * Delete a service account
 */
export async function deleteServiceAccount(accessKey: string): Promise<void> {
    try {
        await makeAdminRequest('DELETE', `/minio/admin/v3/delete-service-account?accessKey=${accessKey}`);
    } catch (error) {
        console.error('Failed to delete service account:', error);
        throw new Error('Failed to delete service account. Ensure MinIO credentials have admin privileges.');
    }
}

/**
 * Get service account info
 */
export async function getServiceAccountInfo(accessKey: string): Promise<ServiceAccountInfo | null> {
    try {
        const response = await makeAdminRequest('GET', `/minio/admin/v3/info-service-account?accessKey=${accessKey}`);

        return {
            accessKey: response.accessKey || accessKey,
            createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
        };
    } catch (error) {
        console.error('Failed to get service account info:', error);
        return null;
    }
}
