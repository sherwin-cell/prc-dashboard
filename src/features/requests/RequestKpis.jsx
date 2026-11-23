import { LuCircleCheck, LuClock, LuHandHeart, LuSiren } from "react-icons/lu";

const Card = ({ label, value, note, icon, iconClasses, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black tabular-nums text-gray-900">{value}</p>
      <p className="mt-1 truncate text-xs text-gray-500">{note}</p>
    </div>
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconClasses}`}>{icon}</span>
  </button>
);

/** The four summary cards above the request table (from live Firestore data). */
export default function RequestKpis({ kpis, loading, onPick }) {
  const show = (n) => (loading ? "—" : n);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        label="Pending review"
        value={show(kpis.pending)}
        note="Waiting for PRC to check the BRF and ID"
        icon={<LuClock size={20} />}
        iconClasses="bg-amber-100 text-amber-700"
        onClick={() => onPick({ tab: "pending" })}
      />

      {/* Featured: needed today or overdue and still open. */}
      <button
        type="button"
        onClick={() => onPick({ tab: "all", urgency: "critical" })}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#C81E2B] to-[#991B1B] p-5 text-left text-white shadow-lg shadow-red-900/20 transition hover:-translate-y-0.5"
      >
        <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-100">Critical / Urgent</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{show(kpis.critical)}</p>
            <p className="mt-1 text-xs text-red-100">
              Needed today or overdue{!loading && kpis.criticalPending ? ` · ${kpis.criticalPending} not yet reviewed` : ""}
            </p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
            <LuSiren size={20} />
          </span>
        </div>
      </button>

      <Card
        label="Approved / Matching"
        value={show(kpis.approved)}
        note={loading ? "" : `${kpis.matched} fully matched · ${kpis.prcStock} with PRC stock`}
        icon={<LuHandHeart size={20} />}
        iconClasses="bg-sky-100 text-sky-700"
        onClick={() => onPick({ tab: "approved" })}
      />
      <Card
        label="Fulfilled this month"
        value={show(kpis.fulfilledThisMonth)}
        note="Blood released to the patient"
        icon={<LuCircleCheck size={20} />}
        iconClasses="bg-emerald-100 text-emerald-700"
        onClick={() => onPick({ tab: "fulfilled" })}
      />
    </div>
  );
}
