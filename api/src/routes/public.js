import { Router } from "express";
import { pool } from "../db.js";
import { HttpError } from "../errors.js";

export const publicRouter = Router();

const LIVE = "a.status = 'published' AND a.deleted_at IS NULL";

publicRouter.get("/articles", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const tag = typeof req.query.tag === "string" ? req.query.tag : null;
  const author = /^\d{1,9}$/.test(String(req.query.author ?? "")) ? Number(req.query.author) : null;

  const { rows } = await pool.query(
    `SELECT a.slug, a.title, a.summary, a.image_url, a.published_at,
            au.id AS author_id, au.name AS author_name, au.picture_url AS author_picture_url
       FROM articles a JOIN authors au ON au.id = a.author_id
      WHERE ${LIVE}
        AND ($1::text IS NULL OR EXISTS (
              SELECT 1 FROM article_tags x JOIN tags t ON t.id = x.tag_id
               WHERE x.article_id = a.id AND t.slug = $1))
        AND ($2::int IS NULL OR a.author_id = $2)
      ORDER BY a.published_at DESC
      LIMIT $3 OFFSET $4`,
    [tag, author, limit, (page - 1) * limit]
  );
  res.json(rows);
});

publicRouter.get("/articles/:slug", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.slug, a.title, a.summary, a.image_url, a.body_html,
            a.published_at, a.updated_at,
            au.id AS author_id, au.name AS author_name,
            au.description AS author_description, au.picture_url AS author_picture_url,
            COALESCE((SELECT json_agg(json_build_object('name', t.name, 'slug', t.slug) ORDER BY t.name)
                        FROM article_tags x JOIN tags t ON t.id = x.tag_id
                       WHERE x.article_id = a.id), '[]') AS tags
       FROM articles a JOIN authors au ON au.id = a.author_id
      WHERE a.slug = $1 AND ${LIVE}`,
    [req.params.slug]
  );
  if (!rows[0]) throw new HttpError(404, "Not found");
  res.json(rows[0]);
});

publicRouter.get("/authors", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT au.id, au.name, au.description, au.picture_url, count(a.id)::int AS article_count
       FROM authors au JOIN articles a ON a.author_id = au.id AND ${LIVE}
      GROUP BY au.id ORDER BY au.name`
  );
  res.json(rows);
});

publicRouter.get("/authors/:id", async (req, res) => {
  if (!/^\d{1,9}$/.test(req.params.id)) throw new HttpError(404, "Not found");
  const { rows: [author] } = await pool.query(
    "SELECT id, name, description, picture_url FROM authors WHERE id = $1", [req.params.id]);
  if (!author) throw new HttpError(404, "Not found");

  const { rows: articles } = await pool.query(
    `SELECT a.slug, a.title, a.summary, a.image_url, a.published_at
       FROM articles a WHERE a.author_id = $1 AND ${LIVE}
      ORDER BY a.published_at DESC LIMIT 100`, [author.id]);
  res.json({ ...author, articles });
});

publicRouter.get("/tags", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT t.name, t.slug, count(*)::int AS article_count
       FROM tags t
       JOIN article_tags x ON x.tag_id = t.id
       JOIN articles a ON a.id = x.article_id
      WHERE ${LIVE}
      GROUP BY t.id ORDER BY t.name`
  );
  res.json(rows);
});

// For sitemap.xml generation on the public site
publicRouter.get("/sitemap", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT a.slug, a.updated_at FROM articles a WHERE ${LIVE} ORDER BY a.published_at DESC`);
  res.json(rows);
});