import { LuChevronRight, LuInbox, LuPackageCheck } from "react-icons/lu";
import { isRequestArchived, requestStatusClasses, requestStatusLabel, unitsNeededOf } from "../../constants/statuses";
import {
  BLOOD_TYPES,
  QUEUE_TABS,
  SORSOGON_MUNICIPALITIES,
  URGENCY,
  reservedUnitsOf,
  shortId,
  showsUrgency,
  urgencyOf,
} from "./requestQueue";

const selectClasses =
  "rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-[#D91E2A] focus:outline-none";

/**
 * Status tabs, quick filters and the request table. Data, filters and the
 * selection live in ParentBloodRequestsManager.
 */
const BloodRequestsPage = ({ rows, counts, filters, onFilter, selectedId, onSelect, loading, error, compact }) => (
  <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs" aria-label="Blood requests">
    <div role="tablist" aria-label="Request status" className="flex gap-1 overflow-x-auto border-b border-gray-100 px-4 pt-3">
      {QUEUE_TABS.map((t) => {
        const active = t.id === filters.tab;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onFilter({ tab: t.id })}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-xs font-semibold transition-colors ${
              active ? "border-[#D91E2A] text-[#D91E2A]" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 py-px text-[10px] tabular-nums ${active ? "bg-red-50 text-[#D91E2A]" : "bg-gray-100 text-gray-500"}`}>
              {counts[t.id] ?? 0}
            </span>
          </button>
        );
      })}
    </div>

    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Blood type">
        {["", ...BLOOD_TYPES].map((type) => {
          const active = filters.bloodType === type;
          return (
            <button
              key={type || "all"}
              onClick={() => onFilter({ bloodType: type })}
              aria-pressed={active}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                active ? "bg-[#D91E2A] text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:text-[#D91E2A]"
              }`}
            >
              {type || "All"}
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <select aria-label="Municipality" value={filters.municipality} onChange={(e) => onFilter({ municipality: e.target.value })} className={selectClasses}>
          <option value="">All municipalities</option>
          {SORSOGON_MUNICIPALITIES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select aria-label="Urgency" value={filters.urgency} onChange={(e) => onFilter({ urgency: e.target.value })} className={selectClasses}>
          <option value="">Any urgency</option>
          <option value="critical">Critical</option>
          <option value="urgent">Urgent</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>
    </div>

    {error && (
      <p role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>
    )}

    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-white text-[10px] font-bold uppercase tracking-wider text-gray-400">
          <tr className="border-b border-gray-100">
            <th className="px-4 py-3">Patient</th>
            <th className="px-3 py-3">Type</th>
            <th className="px-3 py-3 text-right">Units</th>
            {!compact && <th className="px-3 py-3">Hospital</th>}
            <th className="px-3 py-3">Urgency</th>
            <th className="px-3 py-3">Status</th>
            <th className="w-8 px-2 py-3"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading blood requests...</td></tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-14 text-center text-gray-400">
                <LuInbox size={26} className="mx-auto mb-2" />
                No requests match these filters.
              </td>
            </tr>
          ) : (
            rows.map(({ request, requesterName, municipality }) => {
              const selected = request.id === selectedId;
              const urgency = showsUrgency(request) ? urgencyOf(request) : null;
              const reserved = reservedUnitsOf(request);
              const ageSex = [request.patientAge && `${request.patientAge}y`, request.patientSex].filter(Boolean).join(" ");
              return (
                <tr
                  key={request.id}
                  onClick={() => onSelect(request.id)}
                  aria-selected={selected}
                  className={`cursor-pointer transition-colors ${selected ? "bg-red-50/70" : "hover:bg-gray-50"}`}
                >
                  <td className={`border-l-[3px] px-4 py-3 ${selected ? "border-[#D91E2A]" : "border-transparent"}`}>
                    <p className="max-w-[220px] truncate text-[13px] font-semibold text-gray-900">{request.patientName || "Unnamed patient"}</p>
                    <p className="max-w-[220px] truncate text-[11px] text-gray-500">
                      {requesterName || "Requester"} · <span className="font-mono">{shortId(request.id)}</span>
                      {ageSex ? ` · ${ageSex}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-block min-w-9 rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-center text-[11px] font-extrabold text-[#D91E2A]">
                      {request.bloodType || "?"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className="font-bold text-gray-900">{unitsNeededOf(request)}</span>
                    {reserved > 0 && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-violet-700" title={`${reserved} reserved at PRC`}>
                        <LuPackageCheck size={11} />{reserved}
                      </span>
                    )}
                  </td>
                  {!compact && (
                    <td className="px-3 py-3">
                      <p className="max-w-[200px] truncate font-medium text-gray-800">{request.hospitalName || request.hospital || "—"}</p>
                      <p className="text-[11px] text-gray-400">{municipality || "Municipality not set"}</p>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-3">
                    {urgency ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-gray-700">
                        <span className={`h-2 w-2 rounded-full ${urgency.dot}`} />
                        {urgency.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-gray-400">
                        <span className={`h-2 w-2 rounded-full ${URGENCY.none.dot}`} />—
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${requestStatusClasses(request.status)}`}>
                      {requestStatusLabel(request.status)}
                    </span>
                    {isRequestArchived(request) && (
                      <span className="ml-1 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">Archived</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-gray-300"><LuChevronRight size={16} /></td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  </section>
);

export default BloodRequestsPage;
