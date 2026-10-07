import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { HttpError } from "./errors.js";

const HASH = process.env.ADMIN_PASSWORD_HASH ?? "";
if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(HASH)) {
  console.error("ADMIN_PASSWORD_HASH is missing or malformed. Quote it in .env: ADMIN_PASSWORD_HASH='$2b$12$...'");
  process.exit(1);
}
if ((process.env.JWT_SECRET ?? "").length < 32) {
  console.error("JWT_SECRET must be at least 32 characters");
  process.exit(1);
}
// The signing key includes the hash, so changing the password logs everyone out.
const KEY = `${process.env.JWT_SECRET}:${HASH}`;

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
};

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
  if (!(await bcrypt.compare(password, HASH))) throw new HttpError(401, "Wrong password");

  const token = jwt.sign({ role: "author" }, KEY, { expiresIn: "7d" });
  res.cookie("token", token, { ...cookieOptions, maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ ok: true });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token", cookieOptions);
  res.json({ ok: true });
});

export function requireAuth(req, _res, next) {
  try {
    jwt.verify(req.cookies.token, KEY, { algorithms: ["HS256"] });
  } catch {
    throw new HttpError(401, "Not authenticated");
  }
  next();
}

// Lets the admin frontend check whether it's logged in
authRouter.get("/me", requireAuth, (_req, res) => res.json({ ok: true }));