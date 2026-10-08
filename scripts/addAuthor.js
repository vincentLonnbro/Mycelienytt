import { parseArgs } from "node:util";
import sharp from "sharp";
import pg from "pg";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    bio: { type: "string" },
    picture: { type: "string" },
  },
});

const name = values.name?.trim();
const bio = values.bio?.trim() || null;

if (!name || name.length > 100) {
  console.error('CHECK USAGE DUMBO');
  process.exit(1);
}

const dir = process.env.UPLOAD_DIR || "/data/uploads";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let savedFile = null;

try {
  // Process the picture first, so a bad image stops the script before anything is inserted
  let pictureUrl = null;
  if (values.picture) {
    const file = `${crypto.randomUUID()}.webp`;
    await sharp(values.picture, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(600, 600, { fit: "cover" })
      .webp({ quality: 85 })
      .toFile(path.join(dir, file));
    savedFile = path.join(dir, file);
    pictureUrl = `/uploads/${file}`;
  }

  const { rows: [author] } = await pool.query(
    `INSERT INTO authors (name, description, picture_url)
     VALUES ($1, $2, $3) RETURNING id, name`,
    [name, bio, pictureUrl]
  );
  savedFile = null;   // the file is now referenced by the database
  console.log(`Added author #${author.id}: ${author.name}${pictureUrl ? ` (picture ${pictureUrl})` : ""}`);
} catch (e) {
  if (savedFile) await fs.rm(savedFile, { force: true });   // don't leave an orphaned image behind
  console.error("Failed:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

// USAGE
// docker compose run --rm -v "${PWD}/scripts:/app/scripts:ro" api node scripts/addAuthor.js --name "VINCENT LÖNNBRO" --bio "SHORT BIO"