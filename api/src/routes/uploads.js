import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import crypto from "node:crypto";
import path from "node:path";
import { HttpError } from "../errors.js";

export const uploadRouter = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

uploadRouter.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "No file");

  const name = `${crypto.randomUUID()}.webp`;
  try {
    // sharp decodes the actual bytes, so a renamed non-image fails here.
    // Re-encoding also strips EXIF data (such as GPS location).
    const info = await sharp(req.file.buffer, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: 2000, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(UPLOAD_DIR, name));
    res.status(201).json({ url: `/uploads/${name}`, width: info.width, height: info.height });
  } catch {
    throw new HttpError(400, "Not a valid image");
  }
});