import { apiRequest } from "./apiClient";

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
