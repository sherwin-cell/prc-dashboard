import { apiBlob, apiRequest } from "./apiClient";

// ID photos and Blood Request Forms are private Cloudinary files. Firestore
// stores a "secure://..." reference; blood_connect_backend
// (GET /api/files/view) returns a signed URL that works for a few minutes, and
// only to the file's owner or a PRC admin. Older records still hold public
// links, which are used as they are.

export const isSecureRef = (value) => typeof value === "string" && value.startsWith("secure://");

const cache = new Map(); // ref -> { url, expiresAt }

/** A viewable URL for a stored value: signed for secure:// refs, as-is otherwise. */
export async function resolveFileUrl(value) {
  if (!value) return null;
  if (!isSecureRef(value)) return value;

  const cached = cache.get(value);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { url, expiresIn } = await apiRequest(`/api/files/view?ref=${encodeURIComponent(value)}`);
  // Refresh a little early so a link is never handed out about to expire.
  cache.set(value, { url, expiresAt: Date.now() + Math.max((expiresIn || 60) - 30, 10) * 1000 });
  return url;
}

// ref -> Promise<object URL>. The file stays in this tab's memory only; it is
// never written to the browser cache (the backend sends Cache-Control: no-store).
const inline = new Map();
const MAX_INLINE = 24;

/**
 * A blob: URL for showing a file inside the page (PDF frame or <img>).
 * Cloudinary's signed link downloads the file instead of displaying it, so
 * secure:// files come through GET /api/files/content. Legacy public links
 * are returned as they are.
 */
export function inlineFileUrl(value) {
  if (!value) return Promise.resolve(null);
  if (!isSecureRef(value)) return Promise.resolve(value);
  if (!inline.has(value)) {
    const pending = apiBlob(`/api/files/content?ref=${encodeURIComponent(value)}`).then((blob) =>
      URL.createObjectURL(blob)
    );
    // Forget failures so the next attempt retries.
    pending.catch(() => inline.delete(value));
    inline.set(value, pending);
    if (inline.size > MAX_INLINE) {
      const [oldest, oldestUrl] = inline.entries().next().value;
      inline.delete(oldest);
      oldestUrl.then((url) => URL.revokeObjectURL(url)).catch(() => {});
    }
  }
  return inline.get(value);
}
