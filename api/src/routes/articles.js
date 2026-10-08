import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import slugify from "slugify";
import { pool, tx } from "../db.js";
import { HttpError } from "../errors.js";
import { renderBody, UPLOAD_URL_RE } from "../render.js";

export const articlesRouter = Router();

// ---------- helpers ----------
function idParam(req) {
  if (!/^\d{1,9}$/.test(req.params.id)) throw new HttpError(404, "Not found");
  return Number(req.params.id);
}

const authorId = z.number().int().positive().max(2147483647);

const saveSchema = z.object({
  author_ids: z.array(authorId).min(1).max(10).optional(),   // omit to leave authors unchanged
  title: z.string().trim().max(200),
  summary: z.string().trim().max(500).nullish(),
  image_url: z.string().regex(UPLOAD_URL_RE).nullish().or(z.literal("")),
  body_json: z.any().refine(
    (d) => d?.type === "doc" && Array.isArray(d.content ?? []),
    "Invalid document"
  ),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),   // omit to leave tags unchanged
  base_updated_at: z.string().max(40).optional(),                       // conflict check
});

async function uniqueSlug(db, title, selfId) {
  const base = slugify(title, { lower: true, strict: true }).slice(0, 80) || "article";
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const { rowCount } = await db.query(
      "SELECT 1 FROM articles WHERE slug = $1 AND id <> $2", [candidate, selfId]);
    if (!rowCount) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function setTags(db, articleId, names) {
  const bySlug = new Map();
  for (const name of names) {
    const slug = slugify(name, { lower: true, strict: true });
    if (slug) bySlug.set(slug, name);
  }
  await db.query("DELETE FROM article_tags WHERE article_id = $1", [articleId]);
  for (const [slug, name] of bySlug) {
    const { rows } = await db.query(
      `INSERT INTO tags (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = tags.name RETURNING id`,
      [name, slug]
    );
    await db.query(
      "INSERT INTO article_tags (article_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [articleId, rows[0].id]
    );
  }
}

async function setAuthors(db, articleId, ids) {
  await db.query("DELETE FROM article_authors WHERE article_id = $1", [articleId]);
  await db.query(
    `INSERT INTO article_authors (article_id, author_id)
     SELECT $1, id FROM unnest($2::int[]) AS t(id)
     ON CONFLICT DO NOTHING`,
    [articleId, ids]
  );
}

// Authors of an article as JSON, alphabetical. Used inside queries that alias articles as "a".
const ADMIN_AUTHORS_JSON = `
  COALESCE((SELECT json_agg(json_build_object('id', au.id, 'name', au.name)
                            ORDER BY au.name, au.id)
              FROM article_authors aa JOIN authors au ON au.id = aa.author_id
             WHERE aa.article_id = a.id), '[]')`;

// updated_at is returned as text so it round-trips with full precision
// (a JS Date would drop the microseconds and break the conflict check).

// ---------- list ----------
articlesRouter.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.title, a.slug, a.status, a.published_at, a.updated_at,
            ${ADMIN_AUTHORS_JSON} AS authors
       FROM articles a
      WHERE a.deleted_at IS NULL
      ORDER BY a.updated_at DESC`
  );
  res.json(rows);
});

// ---------- create an empty draft ----------
articlesRouter.post("/", async (req, res) => {
  const { author_ids } = z
    .object({ author_ids: z.array(authorId).min(1).max(10) })
    .parse(req.body);

  const out = await tx(async (db) => {
    const { rows: [a] } = await db.query(
      "INSERT INTO articles DEFAULT VALUES RETURNING id, updated_at::text AS updated_at");
    await setAuthors(db, a.id, author_ids);   // unknown author id -> rollback, nothing is created
    return a;
  });
  res.status(201).json(out);
});

// ---------- read one (for the editor) ----------
articlesRouter.get("/:id", async (req, res) => {
  const { rows: [a] } = await pool.query(
    `SELECT a.id, a.slug, a.status, a.title, a.summary, a.image_url, a.body_json,
            a.published_at, a.updated_at::text AS updated_at,
            ${ADMIN_AUTHORS_JSON} AS authors,
            COALESCE((SELECT json_agg(t.name ORDER BY t.name)
                        FROM article_tags x JOIN tags t ON t.id = x.tag_id
                       WHERE x.article_id = a.id), '[]') AS tags
       FROM articles a
      WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [idParam(req)]
  );
  if (!a) throw new HttpError(404, "Not found");
  res.json(a);
});

// ---------- save / autosave (works for drafts and published articles) ----------
articlesRouter.put("/:id", async (req, res) => {
  const id = idParam(req);
  const d = saveSchema.parse(req.body);
  // Validate and render before taking a row lock
  const { html, text } = renderBody(d.body_json);

  const out = await tx(async (db) => {
    const { rows: [cur] } = await db.query(
      `SELECT status, updated_at::text AS updated_at
         FROM articles WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    if (!cur) throw new HttpError(404, "Not found");

    // Conflict check: the client sends the updated_at from its last response.
    if (d.base_updated_at && d.base_updated_at !== cur.updated_at) {
      throw new HttpError(409, "Someone else changed this article. Reload to see their version.");
    }

    const live = cur.status === "published";
    if (live && !d.title) throw new HttpError(400, "A published article needs a title");

    let summary = d.summary || null;
    if (!summary && live) summary = text.slice(0, 200) || null;

    const { rows: [row] } = await db.query(
      `UPDATE articles
          SET title = $2, summary = $3, image_url = $4, body_json = $5, body_html = $6
        WHERE id = $1
        RETURNING updated_at::text AS updated_at`,
      [id, d.title || "Untitled", summary, d.image_url || null, d.body_json, html]
    );
    if (d.author_ids) await setAuthors(db, id, d.author_ids);
    if (d.tags) await setTags(db, id, d.tags);
    return row;
  });

  res.json(out);
});

// ---------- publish ----------
articlesRouter.post("/:id/publish", async (req, res) => {
  const id = idParam(req);

  const out = await tx(async (db) => {
    const { rows: [art] } = await db.query(
      `SELECT slug, title, body_json FROM articles
        WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [id]);
    if (!art) throw new HttpError(404, "Not found");

    const { rowCount: authorCount } = await db.query(
      "SELECT 1 FROM article_authors WHERE article_id = $1", [id]);
    if (!authorCount) throw new HttpError(400, "Add at least one author before publishing");

    const title = art.title.trim();
    if (!title || title === "Untitled") {
      throw new HttpError(400, "Give the article a title before publishing");
    }
    const { html, text } = renderBody(art.body_json);
    if (!text && !/<(img|iframe)/.test(html)) throw new HttpError(400, "The article is empty");

    const slug = art.slug ?? (await uniqueSlug(db, title, id));   // fixed after the first publish

    const { rows: [row] } = await db.query(
      `UPDATE articles
          SET slug = $2, body_html = $3,
              summary = COALESCE(NULLIF(btrim(summary), ''), $4),
              status = 'published', published_at = COALESCE(published_at, now())
        WHERE id = $1
        RETURNING id, slug, status, published_at, updated_at::text AS updated_at`,
      [id, slug, html, text.slice(0, 200)]
    );
    return row;
  });

  res.json(out);
});

articlesRouter.post("/:id/unpublish", async (req, res) => {
  const { rows: [row] } = await pool.query(
    `UPDATE articles SET status = 'draft'
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, status, updated_at::text AS updated_at`, [idParam(req)]);
  if (!row) throw new HttpError(404, "Not found");
  res.json(row);
});

// ---------- soft delete ----------
articlesRouter.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    `UPDATE articles SET deleted_at = now(), status = 'draft'
      WHERE id = $1 AND deleted_at IS NULL`, [idParam(req)]);
  if (!rowCount) throw new HttpError(404, "Not found");
  res.status(204).end();
});