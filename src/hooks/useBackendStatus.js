import { useEffect, useState } from "react";
import { API_BASE_URL, isApiConfigured } from "../services/apiClient";

const INTERVAL_MS = 30_000;

/**
 * Whether blood_connect_backend answers GET /health:
 * "checking" | "online" | "offline" | "unconfigured".
 */
export function useBackendStatus() {
  const [status, setStatus] = useState(isApiConfigured() ? "checking" : "unconfigured");

  useEffect(() => {
    if (!isApiConfigured()) return undefined;
    let active = true;
    const check = () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      fetch(`${API_BASE_URL}/health`, { signal: controller.signal, cache: "no-store" })
        .then((response) => active && setStatus(response.ok ? "online" : "offline"))
        .catch(() => active && setStatus("offline"))
        .finally(() => clearTimeout(timeout));
    };
    check();
    const timer = setInterval(check, INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return status;
}
