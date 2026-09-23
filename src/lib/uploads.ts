// Product photo uploads (server-only). Files go to media/uploads/ (git-ignored) under random names
// and are served by src/app/uploads/[name]/route.ts, which also works after a production build.
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const UPLOAD_DIR = path.join(process.cwd(), "media", "uploads");
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOADS_PER_SAVE = 5;
export const UPLOAD_NAME = /^[a-f0-9]{24}\.(jpg|png|webp)$/;

/** Detects the real type from the file's first bytes; the browser's claimed type is not trusted. */
function sniff(b: Buffer): "jpg" | "png" | "webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/** Checks every file first, then saves them all; returns public URLs (/uploads/<name>). */
export async function saveUploads(files: File[]): Promise<{ urls: string[] } | { error: string }> {
  if (files.length > MAX_UPLOADS_PER_SAVE) return { error: `Upload at most ${MAX_UPLOADS_PER_SAVE} photos at a time.` };
  const checked: { buf: Buffer; ext: string }[] = [];
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) return { error: `${f.name} is larger than 4 MB.` };
    const buf = Buffer.from(await f.arrayBuffer());
    const ext = sniff(buf);
    if (!ext) return { error: `${f.name} is not a JPG, PNG or WebP image.` };
    checked.push({ buf, ext });
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const urls: string[] = [];
  for (const { buf, ext } of checked) {
    const name = `${randomBytes(12).toString("hex")}.${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, name), buf, { flag: "wx" });
    urls.push(`/uploads/${name}`);
  }
  return { urls };
}

/** Deletes uploaded files that are no longer used. Catalog images under /media are never touched. */
export async function deleteUploads(urls: string[]) {
  for (const url of urls) {
    const name = url.startsWith("/uploads/") ? url.slice("/uploads/".length) : "";
    if (UPLOAD_NAME.test(name)) await fs.rm(path.join(UPLOAD_DIR, name), { force: true });
  }
}
