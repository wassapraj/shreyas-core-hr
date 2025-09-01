import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3 Client configuration
const s3Client = new S3Client({
  region: 'us-east-1', // Will be overridden by environment
  credentials: {
    accessKeyId: 'dummy', // Will be overridden in edge functions
    secretAccessKey: 'dummy',
  },
});

export interface S3UploadResult {
  key: string;
  url?: string;
}

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Initialize S3 client with actual credentials (for edge functions)
 */
export function initS3Client(config: S3Config): S3Client {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/**
 * Generate S3 key for employee files
 */
export function buildKey(employee: any, category: string, filename: string): string {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const employeeId = employee.emp_code || employee.id;
  return `employees/${employeeId}/${category}/${Date.now()}_${sanitizedFilename}`;
}

/**
 * Upload file to S3
 */
export async function putS3Object(
  client: S3Client,
  bucket: string,
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  
  await client.send(command);
}

/**
 * Delete file from S3
 */
export async function deleteS3Object(
  client: S3Client,
  bucket: string,
  key: string
): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  
  await client.send(command);
}

/**
 * Generate signed URL for S3 object
 */
export async function getS3SignedUrl(
  client: S3Client,
  bucket: string,
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  
  return await getSignedUrl(client, command, { expiresIn });
}

/**
 * Slugify filename for S3 key
 */
export function slugifyFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}