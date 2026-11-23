import { useEffect, useState } from "react";
import { LuColumns2, LuExternalLink, LuFileX, LuPanelTop, LuRotateCw } from "react-icons/lu";
import { inlineFileUrl } from "../../services/secureFiles";
import { SecureFileLink } from "./SecureFile";

/** Loads one stored file (secure:// or legacy public link) for inline display. */
function InlineFile({ doc, height }) {
  const [state, setState] = useState({ value: null, url: null, error: "" });
  const [turns, setTurns] = useState(0);

  useEffect(() => {
    let active = true;
    inlineFileUrl(doc.value)
      .then((url) => active && setState({ value: doc.value, url, error: "" }))
      .catch(
        (err) => active && setState({ value: doc.value, url: null, error: err.message || "Could not load the file." })
      );
    return () => {
      active = false;
    };
  }, [doc.value]);

  const box = `relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 ${height}`;
  if (!doc.value) {
    return (
      <div className={`${box} flex flex-col items-center justify-center gap-1 text-xs text-gray-400`}>
        <LuFileX size={22} />
        No {doc.label} was uploaded.
      </div>
    );
  }
  if (state.value !== doc.value) {
    return <div className={`${box} grid place-items-center text-xs text-gray-400`}>Loading {doc.label}...</div>;
  }
  if (state.error) {
    return (
      <div role="alert" className={`${box} flex flex-col items-center justify-center gap-2 p-4 text-center text-xs text-rose-700`}>
        {state.error}
        <SecureFileLink value={doc.value} className="font-semibold underline">Try opening it in a new tab</SecureFileLink>
      </div>
    );
  }

  return (
    <div className={box}>
      {doc.type === "pdf" ? (
        <iframe title={doc.label} src={`${state.url}#view=FitH`} className="h-full w-full bg-white" />
      ) : (
        <div className="grid h-full w-full place-items-center p-2">
          <img
            src={state.url}
            alt={doc.label}
            referrerPolicy="no-referrer"
            style={{ transform: `rotate(${turns * 90}deg)` }}
            className="max-h-full max-w-full object-contain transition-transform"
          />
          <button
            type="button"
            onClick={() => setTurns((t) => (t + 1) % 4)}
            title="Rotate"
            className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-gray-600 shadow-xs hover:text-gray-900"
          >
            <LuRotateCw size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Inline preview of a request's Blood Request Form and ID photos, so PRC can
 * compare them with the typed fields without leaving the page. Files are
 * fetched through the backend as the signed-in admin; nothing is public.
 *
 * documents: [{ id, label, type: "pdf" | "image", value }]
 */
export default function DocumentViewer({ documents }) {
  const [activeId, setActiveId] = useState(documents.find((d) => d.value)?.id ?? documents[0]?.id);
  const [split, setSplit] = useState(false);
  const active = documents.find((d) => d.id === activeId) || documents[0];
  const pdf = documents.find((d) => d.type === "pdf");
  const images = documents.filter((d) => d.type === "image");

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xs" aria-label="Submitted documents">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {!split &&
          documents.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActiveId(d.id)}
              aria-pressed={d.id === active?.id}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                d.id === active?.id
                  ? "bg-gray-900 text-white"
                  : d.value
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-gray-50 text-gray-400"
              }`}
            >
              {d.label}
              {!d.value && " (none)"}
            </button>
          ))}
        {split && <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">BRF and IDs side by side</span>}
        <div className="ml-auto flex items-center gap-1">
          {!split && active?.value && (
            <SecureFileLink value={active.value} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800">
              <LuExternalLink size={13} /> New tab
            </SecureFileLink>
          )}
          <button
            type="button"
            onClick={() => setSplit((s) => !s)}
            title={split ? "Show one document at a time" : "Show the BRF and both IDs together"}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            {split ? <LuPanelTop size={13} /> : <LuColumns2 size={13} />}
            {split ? "Tabs" : "Split"}
          </button>
        </div>
      </div>

      {split ? (
        <div className="space-y-2">
          {pdf && <InlineFile doc={pdf} height="h-[420px]" />}
          <div className="grid grid-cols-2 gap-2">
            {images.map((d) => (
              <div key={d.id}>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">{d.label}</p>
                <InlineFile doc={d} height="h-44" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        active && <InlineFile key={active.id} doc={active} height="h-[560px]" />
      )}
    </section>
  );
}
