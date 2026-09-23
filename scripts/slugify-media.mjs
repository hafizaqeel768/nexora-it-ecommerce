// Renames product photos in media/products/ from "Product Title.jpg" to "product-title.jpg"
// and records the original title in src/data/product-images.json (used by the Phase 5 seed).
//
// Usage: npm run media:slugify            (rename + update manifest)
//        npm run media:slugify -- --dry-run (show what would change)
//
// Safe to re-run: files already in slug form are left alone, and it never overwrites a file.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "media/products");
const manifestPath = path.join(root, "src/data/product-images.json");
const dryRun = process.argv.includes("--dry-run");
const imageExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function slugify(text) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : [];
const bySlug = new Map(manifest.map((entry) => [entry.slug, entry]));

let renamed = 0;
const problems = [];

for (const name of fs.readdirSync(dir).sort()) {
  const ext = path.extname(name).toLowerCase();
  if (!imageExt.has(ext)) continue;

  const title = path.basename(name, path.extname(name)).trim();
  const slug = slugify(title);
  const file = `${slug}${ext === ".jpeg" ? ".jpg" : ext}`;

  if (name === file) {
    // Already slugged; make sure it is in the manifest.
    if (!bySlug.has(slug)) bySlug.set(slug, { slug, file, title: slug });
    continue;
  }
  if (bySlug.has(slug) || fs.existsSync(path.join(dir, file))) {
    problems.push(`${name} → ${file} (slug already taken, rename the source file)`);
    continue;
  }

  console.log(`${dryRun ? "would rename" : "renamed"}: ${name} → ${file}`);
  if (!dryRun) fs.renameSync(path.join(dir, name), path.join(dir, file));
  bySlug.set(slug, { slug, file, title });
  renamed++;
}

const next = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
if (!dryRun) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(next, null, 2) + "\n");
}

console.log(
  `\n${dryRun ? "[dry run] " : ""}${renamed} renamed, ${next.length} in manifest, ${problems.length} problem(s)`,
);
for (const p of problems) console.error(`  ✗ ${p}`);
if (problems.length) process.exitCode = 1;
