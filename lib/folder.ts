"use client";

export type PickedFile = { file: File; path: string };

type AnyEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (cb: (f: File) => void, err: (e: unknown) => void) => void;
  createReader?: () => {
    readEntries: (cb: (entries: AnyEntry[]) => void, err: (e: unknown) => void) => void;
  };
};

async function readEntry(entry: AnyEntry, base = ""): Promise<PickedFile[]> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) =>
      entry.file!(resolve, reject)
    );
    return [{ file, path: base + file.name }];
  }
  if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    const entries: AnyEntry[] = [];
    for (;;) {
      const batch = await new Promise<AnyEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject)
      );
      if (batch.length === 0) break;
      entries.push(...batch);
    }
    const nested = await Promise.all(
      entries.map((e) => readEntry(e, `${base}${entry.name}/`))
    );
    return nested.flat();
  }
  return [];
}

export async function filesFromDataTransfer(dt: DataTransfer): Promise<
  { files: PickedFile[]; hasFolder: boolean }
> {
  const items = Array.from(dt.items ?? []);
  const entries = items
    .map((i) => (i.webkitGetAsEntry ? (i.webkitGetAsEntry() as AnyEntry | null) : null))
    .filter(Boolean) as AnyEntry[];

  if (entries.length === 0) {
    return {
      files: Array.from(dt.files).map((file) => ({ file, path: file.name })),
      hasFolder: false,
    };
  }

  const hasFolder = entries.some((e) => e.isDirectory);
  const nested = await Promise.all(entries.map((e) => readEntry(e)));
  return { files: nested.flat(), hasFolder };
}

export function filesFromInput(input: HTMLInputElement): PickedFile[] {
  return Array.from(input.files ?? []).map((file) => ({
    file,
    path: (file as any).webkitRelativePath || file.name,
  }));
}

export async function zipFiles(
  files: PickedFile[],
  zipName: string,
  onProgress?: (fraction: number) => void
): Promise<File> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const root = files[0]?.path.split("/")[0];
  const stripRoot = root && files.every((f) => f.path.startsWith(`${root}/`));

  // STORE = the archive is a pure container: image and video bytes are copied
  // verbatim, never re-encoded. Quality is identical to the originals.
  files.forEach(({ file, path }) => {
    const name = stripRoot ? path.slice(root!.length + 1) : path;
    zip.file(name, file, { binary: true });
  });

  const blob = await zip.generateAsync(
    {
      type: "blob",
      compression: "STORE",
      streamFiles: true,
      platform: "DOS",
    },
    (meta) => onProgress?.(meta.percent / 100)
  );

  const safeName = zipName.replace(/[\\/:*?"<>|]/g, "_");
  return new File([blob], safeName.endsWith(".zip") ? safeName : `${safeName}.zip`, {
    type: "application/zip",
  });
}

export function guessTransferType(file: File): "image" | "video" | "file" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}
