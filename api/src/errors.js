import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Invalid input",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File too large" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request too large" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  if (err.code === "23503") return res.status(400).json({ error: "Unknown author" });
  console.error(err);
  res.status(500).json({ error: "Server error" });
}