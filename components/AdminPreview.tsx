"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ClipboardCopy,
  Download,
  FileArchive,
  FileText,
  Film,
  Image as ImageIcon,
  PackageOpen,
  X,
} from "lucide-react";
import { cn, formatBytes, formatTime } from "@/lib/utils";

export type AdminRow = {
  id: string;
  type: string;
  file_name: string | null;
  file_size: string | null;
  text_content: string | null;
  mime_type: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  deleted_by_sender: boolean;
  available: boolean;
  sender_name: string;
  recipients: {
    id: string;
    displayName: string;
    status: string;
    deleted: boolean;
  }[];
};

const ICONS: Record<string, typeof FileText> = {
  text: FileText,
  clipboard: ClipboardCopy,
  image: ImageIcon,
  video: Film,
  folder: FileArchive,
  file: PackageOpen,
};

function titleOf(row: AdminRow) {
  if (row.file_name) return row.file_name;
  if (row.text_content) return row.text_content;
  return row.type === "clipboard" ? "Clipboard" : "Text";
}

/** Where the bytes still are, if anywhere. */
function stateOf(row: AdminRow) {
  const expired = new Date(row.expires_at).getTime() < Date.now();
  if (row.available && !expired) return "live" as const;
  if (row.status === "failed") return "failed" as const;
  if (row.status === "uploading") return "uploading" as const;
  return "expired" as const;
}

export default function AdminPreview({
  row,
  onClose,
}: {
  row: AdminRow;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isText = row.type === "text" || row.type === "clipboard";
  const state = stateOf(row);
  const live = state === "live";
  const Icon = ICONS[row.type] ?? FileText;
  const src = `/api/transfers/${row.id}/download?inline=1`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(row.text_content ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - the text is selectable anyway */
    }
  }

  const expiredCopy =
    state === "failed"
      ? "This upload never finished, so there is no file to show."
      : state === "uploading"
        ? "The sender is still uploading this one."
        : "Media Expired. Files live for three hours, and this one is gone.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-6 animate-fade-up"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={titleOf(row)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-auto rounded-t-2xl sm:rounded-2xl border border-nexus-border bg-nexus-card shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-nexus-border bg-nexus-card/95 px-4 py-3 backdrop-blur">
          <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-nexus-border bg-black/40 text-nexus-green">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{titleOf(row)}</p>
            <p className="mt-0.5 truncate text-[11px] text-white/35">
              {row.sender_name} →{" "}
              {row.recipients.map((r) => r.displayName).join(", ") || "—"} ·{" "}
              {formatTime(row.created_at)}
              {row.file_size ? ` · ${formatBytes(Number(row.file_size))}` : ""}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              live
                ? "bg-nexus-green/15 text-nexus-green"
                : "bg-white/5 text-white/40",
            )}
          >
            {live
              ? "Live"
              : state === "failed"
                ? "Failed"
                : state === "uploading"
                  ? "Uploading"
                  : "Expired"}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-white/40 transition-all hover:bg-white/5 hover:text-white active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {isText ? (
            row.text_content ? (
              <div className="rounded-xl border border-nexus-border bg-black/40">
                <div className="flex items-center justify-between gap-2 px-3 pt-2">
                  <span
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-wider",
                      copied ? "text-nexus-green" : "text-white/25",
                    )}
                  >
                    {copied ? "Copied" : "Text Box"}
                  </span>
                  <button
                    onClick={copy}
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-medium transition-colors",
                      copied
                        ? "text-nexus-green"
                        : "text-white/40 hover:text-white",
                    )}
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <ClipboardCopy className="h-3 w-3" />
                    )}
                    {copied ? "" : "Copy"}
                  </button>
                </div>
                <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words px-3.5 pb-3.5 pt-1.5 font-sans text-sm leading-relaxed text-white/85">
                  {row.text_content}
                </pre>
              </div>
            ) : (
              <Gone text={expiredCopy} />
            )
          ) : live ? (
            row.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={row.file_name ?? "image"}
                className="max-h-[60vh] w-full rounded-xl bg-black/40 object-contain"
              />
            ) : row.type === "video" ? (
              <video
                src={src}
                controls
                playsInline
                className="max-h-[60vh] w-full rounded-xl bg-black/40"
              />
            ) : (
              <div className="rounded-xl border border-nexus-border bg-black/40 p-4">
                <p className="text-sm font-medium break-all">
                  {row.file_name ?? "File"}
                </p>
                <p className="mt-1 text-[11px] text-white/35">
                  {row.mime_type ?? "File"}
                  {row.file_size
                    ? ` · ${formatBytes(Number(row.file_size))}`
                    : ""}
                </p>
              </div>
            )
          ) : (
            <Gone text={expiredCopy} />
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {live && !isText && (
              <a
                href={`/api/transfers/${row.id}/download`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-nexus-green px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-[#009648] active:scale-95"
              >
                <Download className="h-4 w-4" />
                Download
                {row.file_size
                  ? ` · ${formatBytes(Number(row.file_size))}`
                  : ""}
              </a>
            )}
            {!live && (
              <span className="inline-flex items-center gap-2 rounded-xl border border-dashed border-nexus-border px-3 py-2 text-xs text-white/40">
                <X className="h-3.5 w-3.5" />
                Media Expired
              </span>
            )}
            {row.deleted_by_sender && (
              <span className="text-[11px] text-white/30">
                removed by sender
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {row.recipients.map((r) => (
                <span
                  key={r.id}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px]",
                    r.status === "downloaded"
                      ? "bg-nexus-green/15 text-nexus-green"
                      : r.status === "declined"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-white/5 text-white/50",
                  )}
                >
                  {r.displayName} · {r.status}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Gone({ text }: { text: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-nexus-border bg-black/30 px-4 py-10 text-center">
      <PackageOpen className="mb-2 h-6 w-6 text-white/25" />
      <p className="text-sm text-white/45">{text}</p>
    </div>
  );
}
