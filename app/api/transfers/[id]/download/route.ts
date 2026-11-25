import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import {
  getDownloadUrl,
  isR2Configured,
  localExists,
  objectExists,
  openLocalStream,
} from "@/lib/storage";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

/** A readable page instead of raw XML when a file cannot be served. */
function problem(title: string, detail: string, status: number) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — NexSend</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#fff;
       font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px}
  .card{max-width:380px;text-align:center}
  h1{font-size:17px;margin:0 0 10px;font-weight:650;letter-spacing:-.01em}
  p{margin:0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.5)}
  a{display:inline-block;margin-top:22px;background:#00A651;color:#000;text-decoration:none;
    font-weight:600;font-size:13px;padding:11px 20px;border-radius:12px}
</style></head>
<body><div class="card">
  <h1>${title}</h1>
  <p>${detail}</p>
  <a href="/history">Back to History</a>
</div></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

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

    if (t.type === "text" || t.type === "clipboard" || !t.storage_key) {
      return NextResponse.json({ error: "Nothing to download" }, { status: 400 });
    }

    if (t.status === "failed") {
      return problem(
        "This upload didn't finish",
        "The file never reached storage, so there is nothing to download. Ask the sender to send it again.",
        410
      );
    }
    if (t.status === "uploading") {
      return problem(
        "Still uploading",
        "The sender's upload has not finished yet. Try again in a moment.",
        409
      );
    }

    if (new Date(t.expires_at).getTime() < Date.now()) {
      return problem(
        "Download window closed",
        "Files stay available for three hours after they are sent. This one has expired — ask the sender to send it again.",
        410
      );
    }

    // Which backend actually holds these bytes.
    const kind: "r2" | "local" =
      t.storage_kind === "r2" || t.storage_kind === "local"
        ? t.storage_kind
        : localExists(t.storage_key)
          ? "local"
          : "r2";

    const markDownloaded = async () => {
      if (isRecipient && t.my_status === "pending" && !inline) {
        await query(
          `UPDATE transfer_recipients SET status = 'downloaded', updated_at = NOW()
           WHERE transfer_id = $1 AND recipient_id = $2`,
          [params.id, user.userId]
        );
      }
    };

    if (kind === "r2" && isR2Configured()) {
      if (!(await objectExists(t.storage_key))) {
        return problem(
          "This file isn't in storage",
          "It was sent before cloud storage was switched on, or the upload was interrupted. Ask the sender to send it again.",
          410
        );
      }
      const url = await getDownloadUrl(
        t.storage_key,
        t.file_name ?? "file",
        inline
      );
      if (!url) {
        return problem("Storage unavailable", "Please try again in a moment.", 503);
      }
      await markDownloaded();
      return new NextResponse(null, {
        status: 307,
        headers: { Location: url, "Cache-Control": "no-store" },
      });
    }

    if (!localExists(t.storage_key)) {
      return problem(
        "This file isn't in storage",
        "It was sent before cloud storage was switched on, or the upload was interrupted. Ask the sender to send it again.",
        410
      );
    }

    await markDownloaded();
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
