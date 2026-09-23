// Serves uploaded product photos from media/uploads/ (names are random and never change, so cache forever).
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR, UPLOAD_NAME } from "@/lib/uploads";

const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!UPLOAD_NAME.test(name)) return new Response("Not found", { status: 404 });
  try {
    const file = await fs.readFile(path.join(UPLOAD_DIR, name));
    const ext = name.split(".").pop() as keyof typeof TYPES;
    return new Response(file, {
      headers: { "Content-Type": TYPES[ext], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
