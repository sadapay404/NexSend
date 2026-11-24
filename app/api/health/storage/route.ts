import { NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

  // Simulate exactly what the browser does: presigned PUT straight to R2 with
  // an Origin header. Catches a missing CORS rule before a real upload fails.
  if (steps.write === "ok") {
    const origin = "https://nexsend-sand.vercel.app";
    const Key2 = `_selftest/cors-${Date.now()}.txt`;
    try {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket, Key: Key2, ContentType: "text/plain" }),
        { expiresIn: 300 }
      );
      const pre = await fetch(url, {
        method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "PUT" },
      });
      const allow = pre.headers.get("access-control-allow-origin");
      steps.preflight = allow ? `ok (${allow})` : `no CORS header for ${origin}`;

      const put = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "text/plain", Origin: origin },
        body: "cors",
      });
      const putAllow = put.headers.get("access-control-allow-origin");
      steps.browserUpload =
        put.status === 200
          ? putAllow
            ? "ok"
            : `upload ok but no CORS header for ${origin}`
          : `${put.status}: ${(await put.text()).slice(0, 140)}`;
      await client.send(new DeleteObjectCommand({ Bucket, Key: Key2 }));
    } catch (e) {
      steps.browserUpload = errText(e);
    }
  }

  const ok =
    steps.write === "ok" &&
    steps.read === "ok" &&
    steps.delete === "ok" &&
    steps.preflight?.startsWith("ok") === true &&
    steps.browserUpload === "ok";

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
