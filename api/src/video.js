export function toEmbedUrl(input) {
  let u;
  try { u = new URL(input); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "");

  // YouTube
  let ytId = null;
  if (host === "youtu.be") ytId = u.pathname.slice(1);
  else if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
    ytId = u.searchParams.get("v")
      || u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1];
  }
  if (ytId && /^[\w-]{11}$/.test(ytId)) {
    return `https://www.youtube-nocookie.com/embed/${ytId}`;
  }

  // Vimeo (including unlisted links that carry a hash)
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(\d{6,})(?:\/([a-f0-9]+))?/);
    if (m) {
      const h = m[2] || u.searchParams.get("h");
      const suffix = h && /^[a-f0-9]+$/.test(h) ? `?h=${h}` : "";
      return `https://player.vimeo.com/video/${m[1]}${suffix}`;
    }
  }
  return null;
}