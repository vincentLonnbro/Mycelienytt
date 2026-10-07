import { generateHTML } from "@tiptap/html";
import sanitizeHtml from "sanitize-html";
import { extensions } from "./editor/extensions.js";
import { toEmbedUrl } from "./video.js";
import { HttpError } from "./errors.js";

export const UPLOAD_URL_RE = /^\/uploads\/[\w-]+\.webp$/;

const bad = (msg) => new HttpError(400, msg);

// Reject anything the editor UI could never have produced.
function validateDoc(node, depth = 0) {
  if (!node || typeof node !== "object" || typeof node.type !== "string") throw bad("Invalid document");
  if (depth > 30) throw bad("Document is nested too deeply");
  if (node.type === "video" && toEmbedUrl(node.attrs?.src) !== node.attrs?.src) {
    throw bad("Only YouTube and Vimeo links are allowed");
  }
  if (node.type === "image" && !UPLOAD_URL_RE.test(node.attrs?.src ?? "")) {
    throw bad("Images must be uploaded through the editor");
  }
  node.content?.forEach((c) => validateDoc(c, depth + 1));
}

const INLINE = new Set(["text", "hardBreak"]);
function plainText(n) {
  if (n.type === "text") return n.text ?? "";
  const inner = (n.content ?? []).map(plainText).join("");
  return INLINE.has(n.type) ? inner : inner + " ";
}

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe"]),
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: ["src", "allowfullscreen", "loading", "referrerpolicy"],
    div: ["class", "data-video"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    "*": ["style"],
  },
  // Only text alignment may be set through style attributes
  allowedStyles: {
    "*": { "text-align": [/^(left|right|center|justify)$/] },
  },
  allowedClasses: { div: ["video-embed"] },
  allowedIframeHostnames: ["www.youtube-nocookie.com", "player.vimeo.com"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

export function renderBody(doc) {
  validateDoc(doc);
  let html;
  try {
    html = generateHTML(doc, extensions);   // throws on node types not in the schema
  } catch {
    throw bad("Document contains unsupported content");
  }
  return {
    html: sanitizeHtml(html, sanitizeOptions),
    text: plainText(doc).replace(/\s+/g, " ").trim(),
  };
}