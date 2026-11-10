import fs from "node:fs";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { awsKeysFromText, type AwsKeyPair } from "../aws-keys";
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

function credentials(): AwsKeyPair | undefined {
  const accessKeyId = String(process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || "").trim();
  if (accessKeyId && secretAccessKey) return { accessKeyId, secretAccessKey };

  // The default credential chain on this machine can be an expired SSO session.
  // Store uploads then fail with 400 before the new store can be finished.
  // The local API already has working static keys; use those for local dev.
  const constantPath = path.resolve(process.cwd(), "../STLAPI/lib/constant.js");
  try {
    return awsKeysFromText(fs.readFileSync(constantPath, "utf8")) ?? undefined;
  } catch {
    return undefined;
  }
}

function s3() {
  if (!client) {
    const keys = credentials();
    client = new S3Client({
      region: region(),
      ...(keys ? { credentials: keys } : {}),
    });
  }
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
