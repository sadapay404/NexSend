import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import {
  isR2Configured,
  listUploadedParts,
  partSize,
  presignSingle,
  signParts,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Which parts already reached storage (used to resume an interrupted upload). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const t = await queryOne<{
      storage_key: string;
      upload_id: string | null;
      status: string;
      file_size: string | number;
      file_name: string;
      type: string;
    }>(
      `SELECT storage_key, upload_id, status, file_size, file_name, type
       FROM transfers WHERE id = $1 AND sender_id = $2`,
      [params.id, user.userId]
    );
    if (!t || t.status !== "uploading") {
      return NextResponse.json({ error: "Nothing to resume" }, { status: 404 });
    }

    const size = Number(t.file_size);
    const r2on = isR2Configured();
    const uploaded =
      r2on && t.upload_id ? await listUploadedParts(t.storage_key, t.upload_id) : [];

    // Tell the client exactly how to continue, including the single-shot case.
    let mode: "multipart" | "single" | "local" = "local";
    let uploadUrl: string | undefined;
    if (r2on) {
      if (t.upload_id) {
        mode = "multipart";
      } else {
        mode = "single";
        uploadUrl = await presignSingle(t.storage_key);
      }
    }

    return NextResponse.json({
      mode,
      uploadUrl,
      uploadId: t.upload_id,
      partSize: partSize(),
      totalParts: Math.max(1, Math.ceil(size / partSize())),
      uploaded,
      file: { name: t.file_name, size, type: t.type },
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const numbers: number[] = Array.isArray(body.partNumbers)
      ? body.partNumbers.filter((n: unknown) => typeof n === "number")
      : [];
    if (numbers.length === 0 || numbers.length > 64) {
      return NextResponse.json({ error: "Bad part numbers" }, { status: 400 });
    }

    const t = await queryOne<{ storage_key: string; upload_id: string }>(
      `SELECT storage_key, upload_id FROM transfers
       WHERE id = $1 AND sender_id = $2 AND status = 'uploading'`,
      [params.id, user.userId]
    );
    if (!t?.upload_id) {
      return NextResponse.json({ error: "No pending upload" }, { status: 404 });
    }

    const urls = await signParts(t.storage_key, t.upload_id, numbers);
    return NextResponse.json({ parts: urls });
  } catch (e) {
    return handleError(e);
  }
}
