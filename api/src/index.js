import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pool } from "./db.js";
import { authRouter, requireAuth } from "./auth.js";
import { publicRouter } from "./routes/public.js";
import { articlesRouter } from "./routes/articles.js";
import { uploadRouter } from "./routes/uploads.js";
import { errorHandler } from "./errors.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api", publicRouter);
app.use("/api/auth", authRouter);

app.use("/api/admin", requireAuth);   // everything below needs the shared password
app.get("/api/admin/authors", async (_req, res) => {
  const { rows } = await pool.query("SELECT id, name FROM authors ORDER BY name");
  res.json(rows);   // for the editor's author dropdown
});
app.use("/api/admin/articles", articlesRouter);
app.use("/api/admin/uploads", uploadRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

app.listen(3000, () => console.log("API listening on :3000"));