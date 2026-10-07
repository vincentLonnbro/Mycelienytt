import sharp from "sharp";
import pg from "pg";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const [authorId, file] = process.argv.slice(2);
if (!/^\d{1,9}$/.test(authorId ?? "") || !file) {
  console.error("Usage: node scripts/set-author-picture.js <author_id> <image_file>");
  process.exit(1);
}

const dir = process.env.UPLOAD_DIR || "/data/uploads";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const { rows: [author] } = await pool.query(
    "SELECT name, picture_url FROM authors WHERE id = $1", [authorId]);
  if (!author) throw new Error(`No author with id ${authorId}`);

  const name = `${crypto.randomUUID()}.webp`;
  await sharp(file, { limitInputPixels: 50_000_000 })
    .rotate()                                        // respect phone orientation
    .resize(600, 600, { fit: "cover" })              // square crop
    .webp({ quality: 85 })
    .toFile(path.join(dir, name));

  const url = `/uploads/${name}`;
  await pool.query("UPDATE authors SET picture_url = $1 WHERE id = $2", [url, authorId]);

  // Remove the previous picture's file so replaced images don't pile up
  if (/^\/uploads\/[\w-]+\.webp$/.test(author.picture_url ?? "")) {
    await fs.rm(path.join(dir, path.basename(author.picture_url)), { force: true });
  }

  console.log(`Set picture for ${author.name}: ${url}`);
} catch (e) {
  console.error("Failed:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

//USAGE
// docker compose run --rm `
//   -v "${PWD}/scripts:/scripts:ro" `
//   -v "PATH-to-image:/tmp/input:ro" `
//   api node scripts/set-author-picture.js 1 /tmp/input