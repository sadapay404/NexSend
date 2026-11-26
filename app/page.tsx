"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send,
  Upload,
  FolderUp,
  ClipboardPaste,
  X,
  File as FileIcon,
  Image as ImageIcon,
  Film,
  FileArchive,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import PersonPicker from "@/components/PersonPicker";
import StoragePill from "@/components/StoragePill";
import { useApp } from "@/components/AppStateProvider";
import { createTextTransfer, sendFile } from "@/lib/client-upload";
import {
  filesFromDataTransfer,
  filesFromInput,
  guessTransferType,
  zipFiles,
  type PickedFile,
} from "@/lib/folder";
import { formatBytes, cn } from "@/lib/utils";
import type { TransferType } from "@/lib/types";

type Staged = {
  id: string;
  file: File;
  type: TransferType;
  progress: number;
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
};

const MAX_BYTES = 2 * 1024 * 1024 * 1024;

function iconFor(type: TransferType) {
  if (type === "image") return ImageIcon;
  if (type === "video") return Film;
  if (type === "folder") return FileArchive;
  return FileIcon;
}

export default function SendPage() {
  const { state, refresh, patchPerson } = useApp();
  const [mode, setMode] = useState<"text" | "files">("files");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );
  const [dragging, setDragging] = useState(false);
  const [preparing, setPreparing] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const clipTried = useRef(false);

  const people = state?.people ?? [];
  const onlineCount = people.filter((p) => p.online).length;

  useEffect(() => {
    if (mode !== "text" || clipTried.current) return;
    clipTried.current = true;
    (async () => {
      try {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.trim().length > 0) {
          setText((current) => (current ? current : clip));
        }
      } catch {
        /* clipboard needs a gesture - the Paste button covers that */
      }
    })();
  }, [mode]);

  const addPicked = useCallback(async (picked: PickedFile[], folderName?: string) => {
    const tooBig = picked.filter((p) => p.file.size > MAX_BYTES);
    const usable = picked.filter((p) => p.file.size <= MAX_BYTES);
    if (tooBig.length) {
      setNotice({ kind: "err", text: `${tooBig[0].file.name} is over the 2 GB limit` });
    }
    if (usable.length === 0) return;

    if (folderName) {
      setPreparing(`Zipping ${folderName}`);
      try {
        const zip = await zipFiles(usable, folderName);
        setStaged((prev) => [
          ...prev,
          { id: crypto.randomUUID(), file: zip, type: "folder", progress: 0, status: "ready" },
        ]);
      } catch {
        setNotice({ kind: "err", text: "Could not zip that folder" });
      } finally {
        setPreparing(null);
      }
      return;
    }

    setStaged((prev) => [
      ...prev,
      ...usable.map(({ file }) => ({
        id: crypto.randomUUID(),
        file,
        type: guessTransferType(file) as TransferType,
        progress: 0,
        status: "ready" as const,
      })),
    ]);
  }, []);

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const { files, hasFolder } = await filesFromDataTransfer(e.dataTransfer);
    if (files.length === 0) return;
    if (hasFolder) {
      const roots = new Map<string, PickedFile[]>();
      for (const f of files) {
        const root = f.path.includes("/") ? f.path.split("/")[0] : "";
        const key = root || "__files__";
        roots.set(key, [...(roots.get(key) ?? []), f]);
      }
      for (const [root, group] of roots) {
        if (root === "__files__") await addPicked(group);
        else await addPicked(group, root);
      }
    } else {
      await addPicked(files);
    }
  }

  function toggleFavorite(id: string, favorite: boolean) {
    patchPerson(id, { favorite }); // flips instantly
    fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, favorite }),
    }).then(() => refresh());
  }

  async function sendText() {
    if (!text.trim() || selected.length === 0) return;
    setSending(true);
    setNotice(null);
    try {
      await createTextTransfer({ type: "text", text, recipientIds: selected });
      setText("");
      setNotice({ kind: "ok", text: "Sent" });
      await refresh();
    } catch (e) {
      setNotice({ kind: "err", text: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  async function sendFiles() {
    if (staged.length === 0 || selected.length === 0) return;
    setSending(true);
    setNotice(null);
    let failed = 0;

    for (const item of staged) {
      setStaged((prev) =>
        prev.map((s) =>
          s.id === item.id ? { ...s, status: "uploading", progress: 0, error: undefined } : s
        )
      );
      try {
        await sendFile({
          file: item.file,
          type: item.type,
          recipientIds: selected,
          onProgress: (fraction) =>
            setStaged((prev) =>
              prev.map((s) => (s.id === item.id ? { ...s, progress: fraction } : s))
            ),
        });
        setStaged((prev) =>
          prev.map((s) =>
            s.id === item.id ? { ...s, status: "done", progress: 1 } : s
          )
        );
      } catch (e) {
        failed += 1;
        setStaged((prev) =>
          prev.map((s) =>
            s.id === item.id
              ? { ...s, status: "error", error: (e as Error).message }
              : s
          )
        );
      }
    }

    setSending(false);
    await refresh();
    if (failed === 0) {
      setNotice({ kind: "ok", text: "Sent" });
      setTimeout(() => setStaged([]), 900);
    } else {
      setNotice({ kind: "err", text: "Some files did not upload" });
    }
  }

  const canSend =
    selected.length > 0 &&
    !sending &&
    ((mode === "text" && text.trim().length > 0) ||
      (mode === "files" && staged.some((s) => s.status !== "done")));

  const recent = (state?.sent ?? []).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="hidden md:block text-2xl font-bold tracking-tight">Send</h1>
          <p className="text-xs md:text-sm text-white/45 md:mt-0.5">
            {onlineCount > 0
              ? `${onlineCount} of ${people.length} online`
              : `${people.length} people · nobody online`}
          </p>
        </div>
        <div className="w-36 sm:w-48 shrink-0 pb-0.5">
          <StoragePill storage={state?.storage} compact />
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Send to
          </h2>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="text-xs text-white/40 hover:text-white"
            >
              Clear ({selected.length})
            </button>
          )}
        </div>
        {state ? (
          <PersonPicker
            people={people}
            selected={selected}
            onChange={setSelected}
            onToggleFavorite={toggleFavorite}
          />
        ) : (
          <div className="flex gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-14 h-14 rounded-full bg-white/5 animate-pulse shrink-0"
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
        <div className="p-2">
          <div className="relative flex bg-black/50 border border-nexus-border rounded-xl p-1">
            <span
              className={cn(
                "absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-nexus-green transition-transform duration-300 ease-out",
                mode === "files" ? "translate-x-0" : "translate-x-[calc(100%+4px)]"
              )}
            />
            {(["files", "text"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "relative flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-200",
                  mode === m ? "text-black" : "text-white/45"
                )}
              >
                {m === "text" ? "Text" : "Files"}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {mode === "text" ? (
            <div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or Paste Anything"
                rows={6}
                className="w-full bg-black/40 border border-nexus-border rounded-xl px-3.5 py-3 text-sm outline-none focus:border-nexus-green resize-y"
              />
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={async () => {
                    try {
                      const clip = await navigator.clipboard.readText();
                      if (clip) setText(clip);
                    } catch {
                      setNotice({
                        kind: "err",
                        text: "Clipboard blocked by the browser - paste with Ctrl+V",
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Paste from clipboard
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                  dragging
                    ? "border-nexus-green bg-nexus-green/5"
                    : "border-nexus-border hover:border-white/20"
                )}
              >
                <Upload className="w-7 h-7 mx-auto text-white/30" />
                <p className="text-sm mt-2">Drop files or folders here</p>
                <p className="text-[11px] text-white/35 mt-1">
                  Images, videos, documents, whole folders — original quality, up to 2 GB
                </p>
                <div className="grid grid-cols-2 gap-2 mt-4 max-w-xs mx-auto">
                  <button
                    onClick={() => fileInput.current?.click()}
                    className="text-xs bg-white/10 hover:bg-white/15 active:scale-95 px-3 py-3 rounded-xl transition-all"
                  >
                    Choose files
                  </button>
                  <button
                    onClick={() => folderInput.current?.click()}
                    className="inline-flex items-center justify-center gap-1.5 text-xs bg-white/10 hover:bg-white/15 active:scale-95 px-3 py-3 rounded-xl transition-all"
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                    Choose folder
                  </button>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  onChange={async (e) => {
                    if (e.target.files) await addPicked(filesFromInput(e.target));
                    e.target.value = "";
                  }}
                />
                <input
                  ref={folderInput}
                  type="file"
                  hidden
                  multiple
                  // @ts-expect-error non-standard but supported in Chromium/WebKit
                  webkitdirectory=""
                  directory=""
                  onChange={async (e) => {
                    const picked = filesFromInput(e.target);
                    e.target.value = "";
                    if (picked.length === 0) return;
                    const root = picked[0].path.split("/")[0] ?? "folder";
                    await addPicked(picked, root);
                  }}
                />
              </div>

              {preparing && (
                <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {preparing}…
                </div>
              )}

              {staged.length > 0 && (
                <div className="mt-3 space-y-2">
                  {staged.map((item) => {
                    const Icon = iconFor(item.type);
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-nexus-border bg-black/30 p-3"
                      >
                        <div className="flex items-center gap-3">
                          {item.type === "image" ? (
                            <Thumb file={item.file} />
                          ) : (
                            <Icon className="w-4 h-4 text-nexus-green shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">
                              {item.file.name}
                            </p>
                            <p className="text-[11px] text-white/35">
                              {formatBytes(item.file.size)}
                              {item.type === "folder" ? " · zipped folder" : ""}
                            </p>
                          </div>
                          {item.status === "done" && (
                            <CheckCircle2 className="w-4 h-4 text-nexus-green" />
                          )}
                          {item.status === "error" && (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          )}
                          {item.status === "ready" && (
                            <button
                              onClick={() =>
                                setStaged((prev) => prev.filter((s) => s.id !== item.id))
                              }
                              className="p-1 text-white/35 hover:text-white"
                              aria-label="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {item.status === "uploading" && (
                          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden progress-track">
                            <div
                              className="h-full progress-fill rounded-full"
                              style={{ width: `${Math.round(item.progress * 100)}%` }}
                            />
                          </div>
                        )}
                        {item.error && (
                          <p className="text-[11px] text-red-400 mt-1">{item.error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-nexus-border p-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-white/35">
            {selected.length === 0
              ? "Pick who receives this"
              : `${selected.length} recipient${selected.length > 1 ? "s" : ""}`}
          </p>
          <button
            onClick={mode === "text" ? sendText : sendFiles}
            disabled={!canSend}
            className="flex-1 md:flex-none justify-center inline-flex items-center gap-2 bg-nexus-green text-black text-sm font-semibold px-5 py-3 md:py-2.5 rounded-xl hover:bg-[#009648] hover:shadow-[0_10px_30px_-10px_rgba(0,166,81,0.9)] active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? "Sending" : "Send"}
          </button>
        </div>
      </section>

      {notice && (
        <p
          className={cn(
            "text-sm rounded-xl px-3 py-2",
            notice.kind === "ok"
              ? "bg-nexus-green/10 text-nexus-green"
              : "bg-red-500/10 text-red-400"
          )}
        >
          {notice.text}
        </p>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">
            Recent
          </h2>
          <div className="space-y-2">
            {recent.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-nexus-border bg-nexus-card px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate">
                    {t.type === "text" || t.type === "clipboard"
                      ? t.text?.slice(0, 60) || "Text"
                      : t.fileName}
                  </span>
                  <span className="block text-[11px] text-white/35">
                    {t.recipients.map((r) => r.displayName).join(", ")}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-md",
                    t.expired
                      ? "bg-white/5 text-white/35"
                      : "bg-nexus-green/10 text-nexus-green"
                  )}
                >
                  {t.expired
                    ? "Expired"
                    : t.recipients.some((r) => r.status === "downloaded")
                    ? "Delivered"
                    : t.recipients.some((r) => r.status === "accepted")
                    ? "Accepted"
                    : "Waiting"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Thumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return <span className="w-9 h-9 rounded-lg bg-white/5 shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
  );
}
