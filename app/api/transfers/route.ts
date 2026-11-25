import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import { beginUpload, isR2Configured, makeKey } from "@/lib/storage";
import { shouldAutoAccept } from "@/lib/transfers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  type: z.enum(["text", "clipboard", "image", "video", "file", "folder"]),
  text: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
  recipientIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid transfer" }, { status: 400 });
    }

    const { type, text, fileName, fileSize, mimeType } = parsed.data;
    const recipientIds = [...new Set(parsed.data.recipientIds)].filter(
      (id) => id !== user.userId
    );
    if (recipientIds.length === 0) {
      return NextResponse.json({ error: "Choose at least one recipient" }, { status: 400 });
    }

    const validRecipients = await query<{ id: string }>(
      `SELECT id FROM users WHERE id = ANY($1::uuid[])`,
      [recipientIds]
    );
    if (validRecipients.length !== recipientIds.length) {
      return NextResponse.json({ error: "Unknown recipient" }, { status: 400 });
    }

    const isTextLike = type === "text" || type === "clipboard";
    if (isTextLike && !text) {
      return NextResponse.json({ error: "Nothing to send" }, { status: 400 });
    }
    if (!isTextLike && (!fileName || !fileSize)) {
      return NextResponse.json({ error: "Missing file details" }, { status: 400 });
    }
    if (!isTextLike && fileSize! > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json({ error: "File is over the 2 GB limit" }, { status: 413 });
    }

    const transfer = await queryOne<{ id: string }>(
      `INSERT INTO transfers
         (sender_id, type, title, text_content, file_name, file_size, mime_type, storage_key, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        user.userId,
        type,
        isTextLike ? null : fileName,
        isTextLike ? text : null,
        isTextLike ? null : fileName,
        isTextLike ? null : fileSize,
        isTextLike ? null : mimeType ?? "application/octet-stream",
        null,
        isTextLike ? "ready" : "uploading",
      ]
    );
    const transferId = transfer!.id;

    for (const recipientId of recipientIds) {
      const auto = await shouldAutoAccept(recipientId, user.userId);
      await query(
        `INSERT INTO transfer_recipients (transfer_id, recipient_id, status)
         VALUES ($1,$2,$3)
         ON CONFLICT (transfer_id, recipient_id) DO NOTHING`,
        [transferId, recipientId, auto ? "accepted" : "pending"]
      );
    }

    if (isTextLike) {
      return NextResponse.json({ id: transferId, upload: null });
    }

    const key = makeKey(transferId, fileName as string);
    await query(
      `UPDATE transfers SET storage_key = $1, storage_kind = $2 WHERE id = $3`,
      [key, isR2Configured() ? "r2" : "local", transferId]
    );

    const plan = await beginUpload(key, fileSize as number, transferId);

    if (plan.mode === "multipart") {
      await query(`UPDATE transfers SET upload_id = $1 WHERE id = $2`, [
        plan.uploadId,
        transferId,
      ]);
    }

    return NextResponse.json({ id: transferId, upload: plan, key });
  } catch (e) {
    return handleError(e);
  }
}
