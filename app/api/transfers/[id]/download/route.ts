import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import {
  getDownloadUrl,
  isR2Configured,
  localExists,
  openLocalStream,
} from "@/lib/storage";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const inline = new URL(req.url).searchParams.get("inline") === "1";

    const t = await queryOne<any>(
      `SELECT t.*, tr.status AS my_status
       FROM transfers t
       LEFT JOIN transfer_recipients tr
         ON tr.transfer_id = t.id AND tr.recipient_id = $2
       WHERE t.id = $1`,
      [params.id, user.userId]
    );

    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isSender = t.sender_id === user.userId;
    const isRecipient = Boolean(t.my_status);
    if (!isSender && !isRecipient) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (new Date(t.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "The download window for this transfer has closed" },
        { status: 410 }
      );
    }

    if (t.type === "text" || t.type === "clipboard" || !t.storage_key) {
      return NextResponse.json({ error: "Nothing to download" }, { status: 400 });
    }

    if (isRecipient && t.my_status === "pending" && !inline) {
      await query(
        `UPDATE transfer_recipients SET status = 'downloaded', updated_at = NOW()
         WHERE transfer_id = $1 AND recipient_id = $2`,
        [params.id, user.userId]
      );
    }

    if (isR2Configured()) {
      const url = await getDownloadUrl(
        t.storage_key,
        t.file_name ?? "file",
        inline
      );
      if (!url) return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
      return NextResponse.redirect(url, 307);
    }

    if (!localExists(t.storage_key)) {
      return NextResponse.json(
        { error: "File is no longer stored" },
        { status: 410 }
      );
    }

    const stream = Readable.toWeb(openLocalStream(t.storage_key)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": t.mime_type ?? "application/octet-stream",
        "Content-Length": String(t.file_size ?? ""),
        "Content-Disposition": `${
          inline ? "inline" : "attachment"
        }; filename*=UTF-8''${encodeURIComponent(t.file_name ?? "file")}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
