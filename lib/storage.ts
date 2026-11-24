import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createWriteStream, createReadStream, existsSync, statSync } from "fs";
import { mkdir, unlink } from "fs/promises";
import { dirname, join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const PART_SIZE = 32 * 1024 * 1024; // 32 MB
const MULTIPART_THRESHOLD = 64 * 1024 * 1024; // 64 MB

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
  );
}

function r2(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });
}

const bucket = () => process.env.R2_BUCKET ?? "nexsend-files";

function localRoot(): string {
  if (process.env.LOCAL_STORAGE_DIR) return process.env.LOCAL_STORAGE_DIR;
  // Serverless filesystems are read-only except /tmp.
  if (process.env.VERCEL) return "/tmp/nexsend/uploads";
  return join(process.cwd(), ".local", "uploads");
}

function localPath(key: string): string {
  return join(localRoot(), key.replace(/\.\./g, ""));
}

export function makeKey(transferId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return `${transferId}/${Date.now()}-${safe}`;
}

export function partSize(): number {
  return PART_SIZE;
}

export function needsMultipart(size: number): boolean {
  return isR2Configured() && size > MULTIPART_THRESHOLD;
}

export type UploadPlan =
  | { mode: "local"; uploadUrl: string }
  | { mode: "single"; uploadUrl: string }
  | { mode: "multipart"; uploadId: string; partSize: number; totalParts: number };

export async function beginUpload(
  key: string,
  size: number,
  transferId: string
): Promise<UploadPlan> {
  if (!isR2Configured()) {
    return {
      mode: "local",
      uploadUrl: `/api/upload?transferId=${transferId}`,
    };
  }

  if (!needsMultipart(size)) {
    const url = await getSignedUrl(
      r2(),
      new PutObjectCommand({ Bucket: bucket(), Key: key }),
      { expiresIn: 3600 }
    );
    return { mode: "single", uploadUrl: url };
  }

  const { UploadId } = await r2().send(
    new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key })
  );

  return {
    mode: "multipart",
    uploadId: UploadId as string,
    partSize: PART_SIZE,
    totalParts: Math.ceil(size / PART_SIZE),
  };
}

export async function signParts(
  key: string,
  uploadId: string,
  partNumbers: number[]
): Promise<{ partNumber: number; url: string }[]> {
  const client = r2();
  return Promise.all(
    partNumbers.map(async (partNumber) => ({
      partNumber,
      url: await getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: bucket(),
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: 3600 }
      ),
    }))
  );
}

export async function listUploadedParts(
  key: string,
  uploadId: string
): Promise<{ partNumber: number; etag: string }[]> {
  const out: { partNumber: number; etag: string }[] = [];
  let marker: string | undefined;
  for (;;) {
    const res = await r2().send(
      new ListPartsCommand({
        Bucket: bucket(),
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: marker,
      })
    );
    for (const p of res.Parts ?? []) {
      if (p.PartNumber && p.ETag) out.push({ partNumber: p.PartNumber, etag: p.ETag });
    }
    if (!res.IsTruncated) break;
    marker = res.NextPartNumberMarker;
  }
  return out;
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[]
): Promise<void> {
  await r2().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    })
  );
}

export async function abortMultipart(key: string, uploadId: string): Promise<void> {
  if (!isR2Configured() || !uploadId) return;
  await r2()
    .send(
      new AbortMultipartUploadCommand({
        Bucket: bucket(),
        Key: key,
        UploadId: uploadId,
      })
    )
    .catch(() => undefined);
}

export async function getDownloadUrl(
  key: string,
  filename: string,
  inline = false
): Promise<string | null> {
  if (!isR2Configured()) return null;
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: `${
        inline ? "inline" : "attachment"
      }; filename*=UTF-8''${encodeURIComponent(filename)}`,
    }),
    { expiresIn: 300 }
  );
}

export async function deleteObject(key: string): Promise<void> {
  if (isR2Configured()) {
    await r2()
      .send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
      .catch(() => undefined);
  }
  const p = localPath(key);
  if (existsSync(p)) await unlink(p).catch(() => undefined);
}

/* ---------- local (preview) storage ---------- */

export async function saveLocalStream(
  key: string,
  body: ReadableStream<Uint8Array>
): Promise<number> {
  const target = localPath(key);
  await mkdir(dirname(target), { recursive: true });
  await pipeline(Readable.fromWeb(body as any), createWriteStream(target));
  return statSync(target).size;
}

export function localExists(key: string): boolean {
  return existsSync(localPath(key));
}

export function openLocalStream(key: string) {
  return createReadStream(localPath(key));
}

export function localSize(key: string): number {
  return existsSync(localPath(key)) ? statSync(localPath(key)).size : 0;
}
