import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { LuDownload, LuMaximize2, LuMinimize2, LuX } from "react-icons/lu";
import { db } from "../../firebase/config";
import BloodRequestsPage from "./BloodRequestsPage";
import BloodRequestDetail from "./BloodRequestDetail";
import RequestKpis from "./RequestKpis";
import {
  QUEUE_TABS,
  matchesSearch,
  municipalityOf,
  queueTabOf,
  requestKpis,
  requestsCsv,
  showsUrgency,
  sortRequests,
  urgencyOf,
  userNameOf,
} from "./requestQueue";
import { useUserProfiles } from "../../hooks/useDocsById";

const TAB_IDS = QUEUE_TABS.map((t) => t.id);
// URL parameter for each filter; the header search writes q.
const PARAM = { tab: "tab", search: "q", bloodType: "type", municipality: "muni", urgency: "urgency", selected: "request" };

function downloadCsv(text) {
  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Excel opens names with ñ correctly.
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `blood-requests-${stamp}.csv` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Blood Requests: KPI cards, the filterable table (left) and the selected
 * request's inspector drawer (right). Filters and the selection are kept in
 * the URL so a view can be linked to and survives reloads.
 */
const ParentBloodRequestsManager = () => {
  const [params, setParams] = useSearchParams();
  const filters = {
    tab: TAB_IDS.includes(params.get(PARAM.tab)) ? params.get(PARAM.tab) : "all",
    search: params.get(PARAM.search) || "",
    bloodType: params.get(PARAM.bloodType) || "",
    municipality: params.get(PARAM.municipality) || "",
    urgency: params.get(PARAM.urgency) || "",
  };
  const selectedId = params.get(PARAM.selected);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  // Live, so approvals, PRC stock notices and cancellations from the app
  // move requests between tabs and KPIs without a reload.
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "blood_requests"), orderBy("createdAt", "desc")),
        (snapshot) => {
          setRequests(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          setError("");
          setLoading(false);
        },
        (err) => {
          console.error("Error loading blood requests:", err);
          setError("Could not load blood requests. Check your connection and admin access.");
          setLoading(false);
        }
      ),
    []
  );

  // Requests do not store the requester's name or municipality; both come
  // from users/{uid}.
  const requesterIds = useMemo(() => requests.map((r) => r.requesterId || r.userId), [requests]);
  const profiles = useUserProfiles(requesterIds);
  const profileOf = (request) => profiles[request.requesterId || request.userId];

  const kpis = useMemo(() => requestKpis(requests), [requests]);

  // Everything except the tab, so the tab counts follow the other filters.
  const filtered = sortRequests(requests)
    .map((request) => ({
      request,
      requesterName: userNameOf(profileOf(request)),
      municipality: municipalityOf(profileOf(request)),
    }))
    .filter(
      ({ request, requesterName, municipality }) =>
        (!filters.bloodType || request.bloodType === filters.bloodType) &&
        (!filters.municipality || municipality.toLowerCase() === filters.municipality.toLowerCase()) &&
        (!filters.urgency || (showsUrgency(request) && urgencyOf(request).level === filters.urgency)) &&
        matchesSearch(request, filters.search, requesterName)
    );

  const counts = { all: filtered.length };
  for (const row of filtered) {
    const tab = queueTabOf(row.request);
    counts[tab] = (counts[tab] || 0) + 1;
  }
  const rows = filters.tab === "all" ? filtered : filtered.filter((row) => queueTabOf(row.request) === filters.tab);

  const selected = requests.find((r) => r.id === selectedId) || null;

  const update = (changes) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(PARAM[key], value);
          else next.delete(PARAM[key]);
        }
        return next;
      },
      { replace: true }
    );

  const onFilter = (changes) => update(changes);
  // A KPI card resets the other quick filters so its number matches the table.
  const onPick = ({ tab, urgency = "" }) => update({ tab, urgency, bloodType: "", municipality: "" });
  const close = () => {
    setExpanded(false);
    update({ selected: null });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D91E2A]">Operations</p>
          <h1 className="mt-1 text-2xl font-extrabold text-gray-900">Blood Requests</h1>
          <p className="mt-1 text-sm text-gray-500">Review, match, and fulfill blood requests across Sorsogon.</p>
        </div>
        <button
          onClick={() => downloadCsv(requestsCsv(rows))}
          disabled={loading || rows.length === 0}
          title="Download the requests in the table as CSV"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-xs transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <LuDownload size={15} /> Export CSV
        </button>
      </div>

      <RequestKpis kpis={kpis} loading={loading} onPick={onPick} />

      <div className="flex items-start gap-5">
        {!(selected && expanded) && (
          <div className={`min-w-0 ${selected ? "hidden lg:block lg:w-[65%]" : "w-full"}`}>
            <BloodRequestsPage
              rows={rows}
              counts={counts}
              filters={filters}
              onFilter={onFilter}
              selectedId={selectedId}
              onSelect={(id) => update({ selected: id })}
              loading={loading}
              error={error}
              compact={Boolean(selected)}
            />
          </div>
        )}

        {selected && (
          <aside
            aria-label="Request inspector"
            className={`sticky top-20 flex h-[calc(100vh-7rem)] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-[#F8F9FB] shadow-lg ${
              expanded ? "w-full" : "w-full lg:w-[35%]"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Request inspector</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded((e) => !e)}
                  title={expanded ? "Back to the table" : "Full review (documents side by side)"}
                  className="hidden rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:inline-flex"
                >
                  {expanded ? <LuMinimize2 size={15} /> : <LuMaximize2 size={15} />}
                </button>
                <button onClick={close} title="Close" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                  <LuX size={16} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <BloodRequestDetail
                key={selected.id}
                request={selected}
                requester={profileOf(selected) || null}
                wide={expanded}
                onBack={close}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default ParentBloodRequestsManager;
