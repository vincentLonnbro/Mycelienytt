export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}
export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const hasBody = options.body !== undefined;
  const res = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });

  if (res.status === 204) return undefined as T;
  if (res.status === 401 && path !== "/auth/login") onUnauthorized?.();
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? "Something went wrong");
  }
  return data as T;
}

export async function uploadImage(file: File): Promise<{ url: string; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Images can be at most 10 MB.");

  const form = new FormData();
  form.append("file", file); // the browser sets the multipart header itself

  let res: Response;
  try {
    res = await fetch("/api/admin/uploads", { method: "POST", body: form, credentials: "same-origin" });
  } catch {
    throw new Error("Could not reach the server.");
  }
  if (res.status === 401) onUnauthorized?.();

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "Upload failed");
  return data;
}