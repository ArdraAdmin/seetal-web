import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { isStoreObjectKey, storeObjectKey } from "../store-eid";

const DEFAULT_BUCKET = "production-bucket-seetal";

function mediaBucket() {
  const configured = String(
    process.env.S3_MEDIA_BUCKET || process.env.PRODUCT_IMAGE_BUCKET || "",
  ).trim();
  return configured || DEFAULT_BUCKET;
}

function region() {
  return String(
    process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1",
  ).trim();
}

let client: S3Client | null = null;

function s3() {
  if (!client) client = new S3Client({ region: region() });
  return client;
}

export async function saveStoreFile(input: {
  storeId: string;
  buffer: Buffer;
  fileName: string;
  contentType: string;
}): Promise<string> {
  const key = storeObjectKey(input.storeId, input.fileName);
  if (!isStoreObjectKey(key)) throw new Error("Unable to store file");
  await s3().send(
    new PutObjectCommand({
      Bucket: mediaBucket(),
      Key: key,
      Body: input.buffer,
      ContentType: input.contentType || "application/octet-stream",
      ServerSideEncryption: "AES256",
      Metadata: {
        kind: "eid",
        storeid: input.storeId,
      },
    }),
  );
  return key;
}

export async function readStoreFile(key: string): Promise<Buffer | null> {
  if (!isStoreObjectKey(key)) return null;
  try {
    const object = await s3().send(
      new GetObjectCommand({ Bucket: mediaBucket(), Key: key }),
    );
    if (!object.Body) return null;
    const bytes = await object.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String(error.name)
        : "";
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw error;
  }
}

export async function deleteStoreFiles(keys: string[]): Promise<void> {
  const unique = [...new Set(keys.filter((key) => isStoreObjectKey(key)))];
  if (unique.length === 0) return;
  await Promise.all(
    unique.map(async (Key) => {
      try {
        await s3().send(new DeleteObjectCommand({ Bucket: mediaBucket(), Key }));
      } catch {
        // A missing object should not block saving the store.
      }
    }),
  );
}
