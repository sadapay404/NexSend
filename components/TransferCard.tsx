"use client";

import { useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Film,
  FileArchive,
  File as FileIcon,
  ClipboardCopy,
  Download,
  Check,
  X,
  Trash2,
  Users,
  Loader2,
} from "lucide-react";
import type { TransferItem } from "@/lib/types";
import { formatBytes, formatTime, cn } from "@/lib/utils";
import Countdown from "./Countdown";

type Props = {
  item: TransferItem;
  perspective: "sent" | "received";
  onChanged?: () => void;
};

function TypeIcon({ type, className }: { type: string; className?: string }) {
  const map: Record<string, any> = {
    text: FileText,
    clipboard: ClipboardCopy,
    image: ImageIcon,
    video: Film,
    folder: FileArchive,
    file: FileIcon,
  };
  const Icon = map[type] ?? FileIcon;
  return <Icon className={className} />;
}

export default function TransferCard({ item, perspective, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const isText = item.type === "text" || item.type === "clipboard";
  const live = !item.expired;
  const canDownload = !isText && live;
  const needsAction = perspective === "received" && item.myStatus === "pending" && live;

  async function act(status: "accepted" | "declined") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/transfers/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not update");
      }
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/transfers/${item.id}`, { method: "DELETE" });
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(item.text ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Clipboard blocked - select the text to copy");
    }
  }

  const statusLabel = (() => {
    if (item.expired) return "Expired";
    if (perspective === "received") {
      switch (item.myStatus) {
        case "pending":
          return "Waiting for you";
        case "accepted":
          return "Accepted";
        case "downloaded":
          return "Downloaded";
        case "declined":
          return "Declined";
        default:
          return "";
      }
    }
    if (item.recipients.length === 0) return "No recipient";
    if (item.recipients.every((r) => r.status === "downloaded")) return "Delivered";
    if (item.recipients.some((r) => r.status === "downloaded")) return "Partly downloaded";
    if (item.recipients.some((r) => r.status === "accepted")) return "Accepted";
    if (item.recipients.every((r) => r.status === "declined")) return "Declined";
    return "Waiting";
  })();

  const isImage = item.type === "image";

  return (
    <div className="rounded-2xl border border-nexus-border bg-nexus-card p-4">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 grid place-items-center shrink-0">
          <TypeIcon type={item.type} className="w-5 h-5 text-nexus-green" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {isText
                  ? item.type === "clipboard"
                    ? "Clipboard"
                    : "Text"
                  : item.fileName ?? "File"}
              </p>
              <p className="text-[11px] text-white/40 mt-0.5">
                {perspective === "sent" ? "To" : "From"}{" "}
                {perspective === "sent"
                  ? item.recipients.map((r) => r.displayName).join(", ") || "—"
                  : item.senderName}
                {" · "}
                {formatTime(item.createdAt)}
                {item.fileSize ? ` · ${formatBytes(item.fileSize)}` : ""}
              </p>
            </div>

            <span
              className={cn(
                "text-[11px] px-2 py-1 rounded-md whitespace-nowrap font-medium",
                item.expired
                  ? "bg-white/5 text-white/40"
                  : item.myStatus === "pending" && perspective === "received"
                  ? "bg-nexus-green/15 text-nexus-green"
                  : "bg-white/5 text-white/60"
              )}
            >
              {statusLabel}
            </span>
          </div>

          {isText && (
            <div className="mt-3">
              <p className="text-sm text-white/80 whitespace-pre-wrap break-words line-clamp-6">
                {item.text}
              </p>
              <button
                onClick={copyText}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-nexus-green hover:underline"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}

          {isImage && live && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/transfers/${item.id}/download?inline=1`}
              alt={item.fileName ?? "image"}
              className="mt-3 rounded-lg max-h-64 object-contain bg-black/40"
              loading="lazy"
            />
          )}

          {item.type === "video" && live && (
            <video
              src={`/api/transfers/${item.id}/download?inline=1`}
              controls
              className="mt-3 rounded-lg max-h-64 w-full bg-black/40"
            />
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {needsAction && (
              <>
                <button
                  onClick={() => act("accepted")}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 bg-nexus-green text-black text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#009648] disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Accept
                </button>
                <button
                  onClick={() => act("declined")}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 border border-nexus-border text-xs px-3 py-1.5 rounded-lg hover:border-white/30"
                >
                  <X className="w-3.5 h-3.5" />
                  Decline
                </button>
              </>
            )}

            {canDownload && (
              <a
                href={`/api/transfers/${item.id}/download`}
                onClick={() => setTimeout(() => onChanged?.(), 800)}
                className="inline-flex items-center gap-1.5 bg-white/10 text-xs px-3 py-1.5 rounded-lg hover:bg-white/15"
              >
                <Download className="w-3.5 h-3.5" />
                {item.fileSize ? formatBytes(item.fileSize) : "Download"}
              </a>
            )}

            <span className="text-[11px] ml-auto">
              {live ? <Countdown expiresAt={item.expiresAt} /> : null}
            </span>

            <button
              onClick={remove}
              disabled={busy}
              aria-label="Remove from list"
              className="p-1.5 rounded-lg text-white/35 hover:text-red-400 hover:bg-white/5"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
        </div>
      </div>

      {perspective === "sent" && item.recipients.length > 1 && (
        <div className="mt-3 pt-3 border-t border-nexus-border flex items-center gap-2 flex-wrap">
          <Users className="w-3.5 h-3.5 text-white/30" />
          {item.recipients.map((r) => (
            <span
              key={r.id}
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-md",
                r.status === "downloaded"
                  ? "bg-nexus-green/15 text-nexus-green"
                  : "bg-white/5 text-white/50"
              )}
            >
              {r.displayName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
