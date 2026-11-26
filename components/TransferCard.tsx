"use client";

import { useEffect, useState } from "react";
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
import Avatar from "./Avatar";

type Props = {
  item: TransferItem;
  perspective: "sent" | "received";
  onChanged?: () => void;
};

const autoTried = new Set<string>();
/** Downloads fire once; download managers take over from there, so we can only
 *  report "started" and offer the link again. */
const downloadStarted = new Set<string>();

/** Fire the browser download without a second tap. Browsers may still ask. */
function triggerDownload(id: string) {
  const a = document.createElement("a");
  a.href = `/api/transfers/${id}/download`;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
}

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
  const [started, setStarted] = useState(() => downloadStarted.has(item.id));
  const [status, setStatus] = useState(item.myStatus);

  useEffect(() => {
    setStatus(item.myStatus);
  }, [item.myStatus]);

  const isText = item.type === "text" || item.type === "clipboard";
  const live = !item.expired;
  const needsAction =
    perspective === "received" && status === "pending" && live;
  // A decline destroys the payload, so the card keeps only a marker.
  const declinedByMe = perspective === "received" && status === "declined";
  const declinedByAll =
    perspective === "sent" &&
    item.recipients.length > 0 &&
    item.recipients.every((r) => r.status === "declined");
  const gone = declinedByMe || declinedByAll;
  const typeLabel =
    item.type === "clipboard"
      ? "Clipboard"
      : item.type.charAt(0).toUpperCase() + item.type.slice(1);
  // Accept is the download: no separate link while the card is still a choice.
  const canDownload =
    !isText && live && !needsAction && !gone && item.fileSize !== null;
  const downloadWasStarted =
    started || downloadStarted.has(item.id) || status === "downloaded";

  // Auto-accepted transfers start downloading on their own, once per session.
  useEffect(() => {
    if (perspective !== "received" || isText || !live) return;
    if (status !== "accepted") return;
    if (autoTried.has(item.id)) return;
    const fresh =
      Date.now() - new Date(item.createdAt).getTime() < 5 * 60 * 1000;
    if (!fresh) return;
    autoTried.add(item.id);
    downloadStarted.add(item.id);
    setStarted(true);
    triggerDownload(item.id);
  }, [item.id, status, item.createdAt, isText, live, perspective]);

  async function act(next: "accepted" | "declined") {
    const previous = status;
    setStatus(next); // optimistic: the card flips immediately
    setBusy(true);
    setError("");
    if (next === "accepted" && !isText) {
      downloadStarted.add(item.id);
      setStarted(true);
      triggerDownload(item.id);
    }
    try {
      const res = await fetch(`/api/transfers/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(previous);
        setError(data.error ?? "Could not update");
      }
      onChanged?.();
    } catch {
      setStatus(previous);
      setError("Network error");
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
    if (item.status === "failed") return "Failed";
    if (item.status === "uploading") return "Uploading";
    if (item.expired) return "Expired";
    if (perspective === "received") {
      switch (status) {
        case "pending":
          return "Waiting";
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
    if (item.recipients.every((r) => r.status === "downloaded"))
      return "Delivered";
    if (item.recipients.some((r) => r.status === "downloaded")) return "Partly";
    if (item.recipients.some((r) => r.status === "accepted")) return "Accepted";
    if (item.recipients.every((r) => r.status === "declined"))
      return "Declined";
    return "Waiting";
  })();

  const textChip = (
    <div
      onClick={copyText}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          copyText();
        }
      }}
      title={item.text ?? ""}
      className={cn(
        "group w-full rounded-xl border bg-black/40 px-3 py-2 cursor-pointer transition-all duration-200",
        copied
          ? "border-nexus-green/60 shadow-[0_0_0_3px_rgba(0,166,81,0.12)]"
          : "border-nexus-border hover:border-white/25",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[9px] font-semibold uppercase tracking-wider transition-colors",
            copied ? "text-nexus-green" : "text-white/25",
          )}
        >
          {copied ? "Copied" : "Text Box"}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-medium transition-colors",
            copied
              ? "text-nexus-green"
              : "text-white/40 group-hover:text-white",
          )}
        >
          {copied ? (
            <Check className="w-3 h-3" />
          ) : (
            <ClipboardCopy className="w-3 h-3" />
          )}
          {copied ? "" : "Copy"}
        </span>
      </div>
      <p className="mt-0.5 truncate text-sm leading-tight text-white/85">
        {item.text}
      </p>
    </div>
  );

  const tail = (
    <>
      <div className="ml-auto flex items-center gap-1">
        <span className="text-[11px] mr-1">
          {live ? <Countdown expiresAt={item.expiresAt} /> : null}
        </span>
        <button
          onClick={remove}
          disabled={busy}
          aria-label="Remove from list"
          className="p-2 rounded-lg text-white/35 hover:text-red-400 hover:bg-white/5 active:scale-90 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "lift rounded-2xl border bg-nexus-card p-4 animate-fade-up",
        needsAction ? "border-nexus-green/60" : "border-nexus-border",
      )}
    >
      <div className="flex gap-3">
        <div className="relative shrink-0">
          {perspective === "received" ? (
            <Avatar
              name={item.senderName}
              userId={item.senderId}
              updatedAt={item.senderAvatarUpdatedAt}
              size={44}
              className="rounded-xl"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-white/5 grid place-items-center">
              <TypeIcon type={item.type} className="w-5 h-5 text-nexus-green" />
            </div>
          )}
          {perspective === "received" && (
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-nexus-card border border-nexus-border grid place-items-center">
              <TypeIcon type={item.type} className="w-3 h-3 text-nexus-green" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {isText
                  ? item.type === "clipboard"
                    ? "Clipboard"
                    : "Text"
                  : (item.fileName ?? "File")}
              </p>
              <p className="text-[11px] text-white/40 mt-0.5 truncate">
                {perspective === "sent" ? "To " : "From "}
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
                "text-[10px] px-2 py-1 rounded-md whitespace-nowrap font-semibold uppercase tracking-wide",
                item.expired
                  ? "bg-white/5 text-white/40"
                  : needsAction
                    ? "bg-nexus-green/15 text-nexus-green"
                    : "bg-white/5 text-white/60",
              )}
            >
              {statusLabel}
            </span>
          </div>

          {isText === false && item.type === "image" && live && !gone && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/transfers/${item.id}/download?inline=1`}
              alt={item.fileName ?? "image"}
              className="mt-3 rounded-xl max-h-64 w-full object-contain bg-black/40"
              loading="lazy"
            />
          )}

          {item.type === "video" && live && !gone && (
            <video
              src={`/api/transfers/${item.id}/download?inline=1`}
              controls
              playsInline
              className="mt-3 rounded-xl max-h-64 w-full bg-black/40"
            />
          )}

          {needsAction && isText && !gone && (
            <div className="mt-3">{textChip}</div>
          )}

          {gone && (
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-dashed border-nexus-border px-3 py-2 text-xs text-white/40">
                <X className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{typeLabel} Request Declined</span>
              </span>
              <div className="ml-auto flex items-center gap-1 shrink-0">
                {tail}
              </div>
            </div>
          )}

          {!gone && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {needsAction && (
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex">
                  <button
                    onClick={() => act("accepted")}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-1.5 bg-nexus-green text-black text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#009648] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Accept
                  </button>
                  <button
                    onClick={() => act("declined")}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-1.5 border border-nexus-border text-sm px-4 py-2.5 rounded-xl hover:border-white/30 active:scale-95 transition-all"
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              )}

              {isText && !gone && !needsAction && (
                <div className="flex-1 min-w-0">{textChip}</div>
              )}
              {canDownload && (
                <a
                  href={`/api/transfers/${item.id}/download`}
                  onClick={() => {
                    downloadStarted.add(item.id);
                    setStarted(true);
                    setTimeout(() => onChanged?.(), 800);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-white/10 text-sm px-4 py-2.5 rounded-xl hover:bg-white/15 active:scale-95 transition-all"
                >
                  <Download className="w-4 h-4" />
                  {downloadWasStarted
                    ? "Download Again"
                    : item.fileSize
                      ? `Download · ${formatBytes(item.fileSize)}`
                      : "Download"}
                </a>
              )}

              {tail}
            </div>
          )}

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
                  : "bg-white/5 text-white/50",
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
