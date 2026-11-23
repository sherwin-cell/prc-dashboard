import { LuSearch, LuPackageCheck, LuInbox } from "react-icons/lu";
import { requestStatusClasses, requestStatusLabel } from "../../constants/statuses";
import {
  QUEUE_TABS,
  formatDate,
  requirementLabel,
  reservedUnitsOf,
  showsUrgency,
  urgencyOf,
} from "./requestQueue";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/**
 * Left column of the Blood Requests workspace: status tabs, search and the
 * filtered queue. Data and selection live in ParentBloodRequestsManager.
 */
const BloodRequestsPage = ({
  items,
  counts,
  tab,
  onTabChange,
  search,
  onSearchChange,
  bloodType,
  onBloodTypeChange,
  selectedId,
  onSelect,
  loading,
  error,
}) => (
  <section className="flex h-full min-h-0 flex-col bg-white" aria-label="Blood request queue">
    <div className="space-y-3 border-b border-gray-100 p-4">
      <div>
        <h1 className="text-base font-bold text-gray-900">Blood Requests</h1>
        <p className="text-[11px] text-gray-500">Review, reserve PRC stock and close out requests</p>
      </div>

      <div role="tablist" aria-label="Request status" className="flex flex-wrap gap-1.5">
        {QUEUE_TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                active ? "bg-[#D32F2F] text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                  active ? "bg-white/25 text-white" : "bg-white text-gray-500"
                }`}
              >
                {counts[t.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search requests</span>
          <LuSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Patient, requester or hospital"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-xs text-gray-800 focus:border-[#D32F2F] focus:outline-none"
          />
        </label>
        <select
          value={bloodType}
          onChange={(e) => onBloodTypeChange(e.target.value)}
          aria-label="Blood type"
          className="rounded-xl border border-gray-200 bg-gray-50 px-2 text-xs font-medium text-gray-700"
        >
          <option value="">All types</option>
          {BLOOD_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto">
      {error && (
        <p role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          {error}
        </p>
      )}
      {loading ? (
        <p className="p-6 text-center text-xs text-gray-500">Loading blood requests...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-10 text-center text-xs text-gray-400">
          <LuInbox size={28} />
          No requests here{search || bloodType ? " match your search" : ""}.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map(({ request, requesterName }) => {
            const selected = request.id === selectedId;
            const urgency = urgencyOf(request);
            const reserved = reservedUnitsOf(request);
            return (
              <li key={request.id}>
                <button
                  onClick={() => onSelect(request.id)}
                  aria-current={selected ? "true" : undefined}
                  className={`w-full border-l-4 px-4 py-3 text-left transition-colors ${
                    selected ? "border-[#D32F2F] bg-red-50/60" : "border-transparent hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {request.patientName || "Unnamed patient"}
                      </p>
                      <p className="truncate text-[11px] text-gray-500">
                        {requesterName ? `By ${requesterName}` : "Requester"} · {request.hospitalName || request.hospital || "No hospital"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-[#D32F2F]">
                      {request.bloodType || "?"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {showsUrgency(request) && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${urgency.classes}`}>
                        {urgency.label}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${requestStatusClasses(request.status)}`}>
                      {requestStatusLabel(request.status)}
                    </span>
                    {reserved > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                        <LuPackageCheck size={11} /> {reserved} at PRC
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-gray-400">
                      {requirementLabel(request).split(" · ").slice(1).join(" · ")} · due {formatDate(request.neededByDate ?? request.neededBy ?? request.requiredDate)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  </section>
);

export default BloodRequestsPage;
