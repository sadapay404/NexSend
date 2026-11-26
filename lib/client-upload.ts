"use client";

import type { TransferType } from "./types";

type Plan =
  | { mode: "local"; uploadUrl: string }
  | { mode: "single"; uploadUrl: string }
  | { mode: "multipart"; uploadId: string; partSize: number; totalParts: number };

const RESUME_PREFIX = "nexsend:resume:";

function resumeKeyFor(file: File) {
  // lastModified keeps same-named files apart; ignored for blobs (folders arrive as .zip)
  return `${RESUME_PREFIX}${file.name}:${file.size}:${file.lastModified ?? 0}`;
}

function putWithProgress(
  url: string,
  body: Blob,
  onLoaded: (bytes: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.upload.onprogress = (e) => onLoaded(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    if (signal) signal.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One retry wrapper for every byte that leaves the browser: a dropped Wi-Fi
 * moment or a 5xx from the bucket should not end the transfer.
 */
async function putWithRetry(
  url: string,
  body: Blob,
  onLoaded: (bytes: number) => void,
  signal?: AbortSignal,
  attempts = 3
): Promise<void> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await putWithProgress(url, body, onLoaded, signal);
    } catch (e) {
      last = e;
      const message = (e as Error).message ?? "";
      if (signal?.aborted) throw e;
      // Expired/forbidden URL needs a fresh signature, not another attempt.
      if (/\b403\b|\b404\b|signature|expired/i.test(message)) throw e;
      if (i < attempts - 1) await sleep(400 * 2 ** i);
    }
  }
  throw last;
}

async function json(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export async function createTextTransfer(params: {
  type: TransferType;
  text: string;
  recipientIds: string[];
}): Promise<string> {
  const res = await fetch("/api/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await json(res);
  return data.id as string;
}

export async function sendFile(params: {
  file: File;
  type: TransferType;
  recipientIds: string[];
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { file, type, recipientIds, onProgress, signal } = params;
  const total = file.size;
  const key = resumeKeyFor(file);

  let transferId: string | null = null;
  let plan: Plan | null = null;

  // 1. Try to resume an interrupted upload of the same file.
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  if (saved) {
    try {
      const res = await fetch(`/api/transfers/${saved}/parts`, { cache: "no-store" });
      if (res.ok) {
        const info = await res.json();
        if (Number(info.file?.size) === total && info.file?.name === file.name) {
          transferId = saved;
          if (info.mode === "multipart" && info.uploadId) {
            plan = {
              mode: "multipart",
              uploadId: info.uploadId,
              partSize: info.partSize,
              totalParts: info.totalParts,
            };
            (plan as any).uploaded = info.uploaded as {
              partNumber: number;
              etag: string;
            }[];
          } else if (info.mode === "single" && info.uploadUrl) {
            plan = { mode: "single", uploadUrl: info.uploadUrl };
          } else {
            plan = {
              mode: "local",
              uploadUrl: `/api/upload?transferId=${saved}`,
            };
          }
        }
      }
    } catch {
      /* fall through to a fresh upload */
    }
  }

  // 2. Fresh transfer.
  if (!transferId) {
    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        recipientIds,
      }),
    });
    const data = await json(res);
    transferId = data.id as string;
    plan = data.upload as Plan;
    localStorage.setItem(key, transferId);
  }

  if (!transferId || !plan) throw new Error("Could not start the transfer");

  // 3. Upload bytes.
  if (plan.mode === "multipart") {
    const uploadedSet = new Set<number>(
      ((plan as any).uploaded ?? []).map((p: any) => Number(p.partNumber))
    );
    const partSize = plan.partSize;
    const loadedByPart = new Map<number, number>();
    const report = () => {
      let sum = 0;
      loadedByPart.forEach((v) => (sum += v));
      onProgress?.(Math.min(1, sum / total));
    };

    uploadedSet.forEach((n) => {
      const start = (n - 1) * partSize;
      loadedByPart.set(n, Math.min(partSize, total - start));
    });
    report();

    const missing: number[] = [];
    for (let n = 1; n <= plan.totalParts; n++) if (!uploadedSet.has(n)) missing.push(n);

    const batches: number[][] = [];
    for (let i = 0; i < missing.length; i += 20) batches.push(missing.slice(i, i + 20));

    for (const batch of batches) {
      const signed = await json(
        await fetch(`/api/transfers/${transferId}/parts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partNumbers: batch }),
        })
      );

      const tasks = (signed.parts as { partNumber: number; url: string }[]).map(
        (p) => async () => {
          const start = (p.partNumber - 1) * partSize;
          const blob = file.slice(start, Math.min(start + partSize, total));
          loadedByPart.set(p.partNumber, 0);
          await putWithRetry(
            p.url,
            blob,
            (loaded) => {
              loadedByPart.set(p.partNumber, loaded);
              report();
            },
            signal
          );
          loadedByPart.set(p.partNumber, blob.size);
          report();
        }
      );

      // three at a time keeps mobile browsers happy
      for (let i = 0; i < tasks.length; i += 3) {
        await Promise.all(tasks.slice(i, i + 3).map((t) => t()));
      }
    }
  } else {
    await putWithRetry(
      plan.uploadUrl,
      file,
      (loaded) => onProgress?.(total ? loaded / total : 1),
      signal
    );
  }

  // 4. Finalise.
  await json(
    await fetch(`/api/transfers/${transferId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
  );

  localStorage.removeItem(key);
  onProgress?.(1);
  return transferId;
}

export function clearResume(file: File) {
  if (typeof localStorage !== "undefined") localStorage.removeItem(resumeKeyFor(file));
}
