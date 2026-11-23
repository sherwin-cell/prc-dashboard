import { auth } from "../firebase/config";

// blood_connect_backend (FastAPI). Set VITE_API_BASE_URL in .env, e.g. the
// deployed HTTPS URL for production builds. In `npm run dev` it falls back to
// the local uvicorn default so the portal works without extra setup.
const LOCAL_BACKEND = "http://127.0.0.1:8000";

export const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? LOCAL_BACKEND : "")
)
  .trim()
  .replace(/\/+$/, "");

export const isApiConfigured = () => API_BASE_URL !== "";

/** fetch() as the signed-in admin (Firebase ID token as Bearer). */
async function authorizedFetch(path, { method = "GET", body } = {}) {
  if (!isApiConfigured()) {
    throw new Error("The backend URL is not configured. Set VITE_API_BASE_URL and rebuild the portal.");
  }
  const user = auth.currentUser;
  if (!user) throw new Error("Your session has ended. Sign in again.");

  const token = await user.getIdToken();
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Could not reach the Blood-Connect backend at ${API_BASE_URL}. Check that it is running.`);
  }
}

async function errorFrom(response) {
  const data = await response.json().catch(() => ({}));
  const error = new Error(data.message || data.detail || `Request failed (${response.status}).`);
  error.status = response.status;
  error.code = data.code;
  error.data = data;
  return error;
}

/**
 * Call the backend as the signed-in admin.
 * Resolves to the JSON body; throws an Error with the backend's message.
 */
export async function apiRequest(path, options) {
  const response = await authorizedFetch(path, options);
  if (!response.ok) throw await errorFrom(response);
  return response.json().catch(() => ({}));
}

/** Like apiRequest, for endpoints that return a file. Resolves to a Blob. */
export async function apiBlob(path) {
  const response = await authorizedFetch(path);
  if (!response.ok) throw await errorFrom(response);
  return response.blob();
}
