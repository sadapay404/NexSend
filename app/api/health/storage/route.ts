import { NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

function errText(e: unknown) {
  const err = e as { name?: string; message?: string };
  return `${err?.name ?? "Error"}: ${(err?.message ?? String(e)).slice(0, 240)}`;
}

/**
 * Self-test for Cloudflare R2. Runs server-side, so it proves credentials,
 * bucket name and endpoint are right. Browser CORS is proven separately by
 * actually sending a file.
 */
export async function GET() {
  const missing = VARS.filter((v) => !process.env[v]);
  if (missing.length) {
    return NextResponse.json({
      storage: "local-disk",
      configured: false,
      missing,
      note: "Add these in Vercel → Settings → Environment Variables, then redeploy.",
    });
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });
  const Bucket = process.env.R2_BUCKET as string;
  const Key = `_selftest/${Date.now()}.txt`;
  const body = `nexsend ${new Date().toISOString()}`;

  const steps: Record<string, string> = {};

  try {
    await client.send(new HeadBucketCommand({ Bucket }));
    steps.bucket = "ok";
  } catch (e) {
    steps.bucket = errText(e);
  }

  try {
    await client.send(
      new PutObjectCommand({ Bucket, Key, Body: body, ContentType: "text/plain" })
    );
    steps.write = "ok";
  } catch (e) {
    steps.write = errText(e);
  }

  if (steps.write === "ok") {
    try {
      const res = await client.send(new GetObjectCommand({ Bucket, Key }));
      const text = await res.Body?.transformToString();
      steps.read = text === body ? "ok" : "mismatch";
    } catch (e) {
      steps.read = errText(e);
    }
    try {
      await client.send(new DeleteObjectCommand({ Bucket, Key }));
      steps.delete = "ok";
    } catch (e) {
      steps.delete = errText(e);
    }
  }

  const ok =
    steps.write === "ok" && steps.read === "ok" && steps.delete === "ok";

  return NextResponse.json({
    storage: "r2",
    working: ok,
    bucket: Bucket,
    steps,
    next: ok
      ? "Storage is ready. Send a file from the app to confirm browser upload works."
      : "Check the failing step above.",
  });
}
