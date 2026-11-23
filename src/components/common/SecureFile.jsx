import { useEffect, useState } from "react";
import { resolveFileUrl } from "../../services/secureFiles";

/** Opens the file in a new tab, fetching a fresh signed URL on click. */
export function SecureFileLink({ value, className = "", children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = async (event) => {
    event.preventDefault();
    setError("");
    // Open the tab synchronously so the browser does not block it as a popup.
    const tab = window.open("", "_blank");
    setBusy(true);
    try {
      const url = await resolveFileUrl(value);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch (err) {
      tab?.close();
      setError(err.message || "Could not open the file.");
    } finally {
      setBusy(false);
    }
  };

  if (!value) return null;
  return (
    <span className="inline-flex flex-col gap-1">
      <a href="#" onClick={open} className={className} aria-busy={busy}>
        {busy ? "Opening..." : children}
      </a>
      {error && <span role="alert" className="text-[11px] text-rose-700">{error}</span>}
    </span>
  );
}

/** Shows a stored image (signed for secure:// refs). */
export function SecureImage({ value, alt, className = "" }) {
  const [state, setState] = useState({ value: null, url: null, error: "" });

  useEffect(() => {
    let active = true;
    resolveFileUrl(value)
      .then((url) => active && setState({ value, url, error: "" }))
      .catch((err) => active && setState({ value, url: null, error: err.message || "Could not load the image." }));
    return () => {
      active = false;
    };
  }, [value]);

  if (!value) return null;
  if (state.value !== value) {
    return <div className={`${className} grid place-items-center bg-gray-50 text-xs text-gray-400`}>Loading...</div>;
  }
  if (state.error) {
    return <div role="alert" className={`${className} grid place-items-center bg-rose-50 p-2 text-center text-xs text-rose-700`}>{state.error}</div>;
  }
  return <img src={state.url} alt={alt} className={className} referrerPolicy="no-referrer" />;
}
