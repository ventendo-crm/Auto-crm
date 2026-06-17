import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;
let bucketReady = false;

function getConfig() {
  const endpoint = process.env.MINIO_ENDPOINT ?? "localhost";
  const port = process.env.MINIO_PORT ?? "9000";
  const useSsl = process.env.MINIO_USE_SSL === "true";
  const accessKey = process.env.MINIO_ACCESS_KEY ?? "minioadmin";
  const secretKey = process.env.MINIO_SECRET_KEY ?? "minioadmin_secret";
  const bucket = process.env.MINIO_BUCKET ?? "auto-crm";
  const publicUrl =
    process.env.MINIO_PUBLIC_URL ?? `${useSsl ? "https" : "http"}://${endpoint}:${port}`;

  return { endpoint, port, useSsl, accessKey, secretKey, bucket, publicUrl };
}

export function getMinioBucket(): string {
  return getConfig().bucket;
}

export function getS3Client(): S3Client {
  if (client) return client;

  const { endpoint, port, useSsl, accessKey, secretKey } = getConfig();

  client = new S3Client({
    endpoint: `${useSsl ? "https" : "http"}://${endpoint}:${port}`,
    region: process.env.MINIO_REGION ?? "us-east-1",
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });

  return client;
}

export async function ensureBucket(): Promise<void> {
  if (bucketReady) return;

  const s3 = getS3Client();
  const { bucket } = getConfig();

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  bucketReady = true;
}

export async function uploadObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  await ensureBucket();

  const s3 = getS3Client();
  const { bucket } = getConfig();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );

  return params.key;
}

export async function deleteObject(key: string): Promise<void> {
  const s3 = getS3Client();
  const { bucket } = getConfig();

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const s3 = getS3Client();
  const { bucket, endpoint, port, useSsl, publicUrl } = getConfig();

  const signed = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn },
  );

  const internalBase = `${useSsl ? "https" : "http"}://${endpoint}:${port}`;
  if (publicUrl !== internalBase) {
    return signed.replace(internalBase, publicUrl.replace(/\/$/, ""));
  }

  return signed;
}

export function buildObjectKey(dealId: string, mediaId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `deals/${dealId}/${mediaId}/${safeName}`;
}

export function buildThumbnailKey(dealId: string, mediaId: string): string {
  return `deals/${dealId}/${mediaId}/thumb.jpg`;
}
