import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, collectionGroup, onSnapshot } from "firebase/firestore";
import {
  LuAward,
  LuCheck,
  LuChevronRight,
  LuHeartPulse,
  LuHourglass,
  LuIdCard,
  LuSearch,
  LuShieldAlert,
  LuShieldCheck,
  LuUsers,
  LuX,
} from "react-icons/lu";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/useAuth";
import { useDocsById, useUserProfiles } from "../../hooks/useDocsById";
import { OfferStatus, donorApplicationStatus, isDonorArchived } from "../../constants/statuses";
import { SORSOGON_MUNICIPALITIES, userNameOf } from "../requests/requestQueue";
import AvailabilityModal from "./AvailabilityModal";
import PendingVerificationQueue from "./PendingVerificationQueue";
import {
  AVAILABILITY_STYLES,
  availabilityActions,
  dateOf,
  getAvailability,
  nameOf,
  todayPhilippines,
} from "./donorAvailability";

const BLOOD_TYPES = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"];
const ELIGIBILITY = [
  { id: "", label: "Any eligibility" },
  { id: "available", label: "Eligible now" },
  { id: "on_interval", label: "On cooldown" },
  { id: "medical_hold", label: "Deferred / needs review" },
];
const selectClasses =
  "rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-[#D91E2A] focus:outline-none";

const uidOf = (donor) => donor.userId || donor.id;

function Kpi({ label, value, note, icon, tone, featured, onClick }) {
  if (featured) {
    return (
      <button type="button" onClick={onClick} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#C81E2B] to-[#991B1B] p-5 text-left text-white shadow-lg shadow-red-900/20 transition hover:-translate-y-0.5">
        <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-100">{label}</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-red-100">{note}</p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">{icon}</span>
        </div>
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
        <p className="mt-2 text-3xl font-black tabular-nums text-gray-900">{value}</p>
        <p className="mt-1 truncate text-xs text-gray-500">{note}</p>
      </div>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>{icon}</span>
    </button>
  );
}

function SelectedDonor({ row, today, onAction, onClose }) {
  const { donor, name, profile, donations, availability } = row;
  const actions = availabilityActions(donor, today);
  const address = [profile?.purok, profile?.barangay || donor.barangay, profile?.municipality || donor.municipality]
    .filter(Boolean)
    .join(", ");
  const facts = [
    ["Donations", donations],
    ["Last donation", dateOf(donor.lastDonationDate || donor.collection?.date)],
    ["Next eligible", dateOf(donor.nextEligibleDonationDate)],
    ["Active since", dateOf(donor.activatedAt)],
  ];
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Selected donor</p>
          <h2 className="truncate text-base font-bold text-gray-900">{name}</h2>
          <p className="truncate text-[11px] text-gray-500">
            {[donor.mobileNo || donor.phoneNumber || profile?.phoneNumber, profile?.email || donor.email].filter(Boolean).join(" · ") || "No contact on file"}
          </p>
          <p className="truncate text-[11px] text-gray-500">{address || "Address not set"}</p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-0.5 text-sm font-extrabold text-[#D91E2A]">{donor.bloodType || "?"}</span>
          <button onClick={onClose} title="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><LuX size={15} /></button>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-gray-50 px-3 py-2">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
            <dd className="text-xs font-bold tabular-nums text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 rounded-xl border border-gray-100 p-3">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${AVAILABILITY_STYLES[availability.key]}`}>{availability.label}</span>
        <p className="mt-1 text-[11px] text-gray-500">{availability.description}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            onClick={() => onAction("available")}
            disabled={!actions.canMarkAvailable}
            title={actions.intervalComplete ? "Record PRC availability clearance" : "The donation interval has not ended"}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
          >
            <LuCheck size={13} /> Mark available
          </button>
          {actions.canPlaceHold && (
            <button onClick={() => onAction("medical_hold")} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">
              <LuShieldAlert size={13} /> Medical hold
            </button>
          )}
          {actions.canReviewHold && (
            <button onClick={() => onAction("lift_hold")} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100">
              <LuShieldCheck size={13} /> Review medical hold
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Donors: KPIs, the active donor table (eligibility, donations, last
 * donation) and a side panel with the selected donor, the pending
 * verification queue and the top lifetime donors.
 *
 * Donations = the first collection recorded at screening (donors/{id}.collection)
 * plus every offer PRC marked "donated" (blood_requests/{id}/offers).
 */
export default function DonorsPage() {
  const { currentUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const filters = {
    bloodType: params.get("type") || "",
    municipality: params.get("muni") || "",
    eligibility: params.get("eligibility") || "",
    search: params.get("q") || "",
  };
  const selectedId = params.get("donor");

  const [donors, setDonors] = useState([]);
  const [donatedByDonor, setDonatedByDonor] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null); // { donor, action }
  const [today] = useState(todayPhilippines);

  useEffect(
    () =>
      onSnapshot(
        collection(db, "donors"),
        (snapshot) => {
          setDonors(snapshot.docs.map((d) => ({ ...d.data(), id: d.id })));
          setLoading(false);
        },
        (err) => {
          console.error("Could not load donors:", err);
          setError("Could not load donors. Check your connection and admin access.");
          setLoading(false);
        }
      ),
    []
  );

  // Admins may read every offer (firestore.rules {path=**}/offers); no index needed.
  useEffect(
    () =>
      onSnapshot(
        collectionGroup(db, "offers"),
        (snapshot) => {
          const counts = {};
          for (const offer of snapshot.docs) {
            const data = offer.data();
            if (String(data.status || "").toLowerCase() === OfferStatus.donated && data.donorId) {
              counts[data.donorId] = (counts[data.donorId] || 0) + 1;
            }
          }
          setDonatedByDonor(counts);
        },
        (err) => console.error("Could not count donations:", err)
      ),
    []
  );

  const active = useMemo(
    () => donors.filter((d) => d.donorActivationStatus === "active" && !isDonorArchived(d)),
    [donors]
  );
  const pending = useMemo(
    () =>
      donors.filter(
        (d) => donorApplicationStatus(d) === "pending" && !isDonorArchived(d) && d.donorActivationStatus !== "active"
      ),
    [donors]
  );

  const uids = useMemo(() => [...active, ...pending].map(uidOf), [active, pending]);
  const profiles = useUserProfiles(uids);
  const pendingUids = useMemo(() => pending.map(uidOf), [pending]);
  const submissions = useDocsById("id_verifications", pendingUids);

  const describe = (donor) => {
    const profile = profiles[uidOf(donor)];
    const ownName = nameOf(donor);
    return {
      donor,
      uid: uidOf(donor),
      profile,
      name: ownName !== "Unnamed donor" ? ownName : userNameOf(profile) || ownName,
      municipality: String(profile?.municipality || profile?.city || donor.municipality || "").trim(),
      barangay: String(profile?.barangay || donor.barangay || "").trim(),
      donations: (donor.collection?.status === "completed" ? 1 : 0) + (donatedByDonor[uidOf(donor)] || 0),
      availability: getAvailability(donor, today),
    };
  };

  const rows = active.map(describe);
  const kpis = {
    total: rows.length,
    available: rows.filter((r) => r.availability.key === "available").length,
    interval: rows.filter((r) => r.availability.key === "on_interval").length,
    hold: rows.filter((r) => r.availability.key === "medical_hold").length,
  };

  const wanted = filters.search.trim().toLowerCase();
  const visible = rows
    .filter(
      (r) =>
        (!filters.bloodType || r.donor.bloodType === filters.bloodType) &&
        (!filters.municipality || r.municipality.toLowerCase() === filters.municipality.toLowerCase()) &&
        (!filters.eligibility || r.availability.key === filters.eligibility) &&
        (!wanted || [r.name, r.donor.id, r.barangay, r.municipality].some((v) => String(v).toLowerCase().includes(wanted)))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const topDonors = [...rows]
    .filter((r) => r.donations > 0)
    .sort((a, b) => b.donations - a.donations || String(b.donor.lastDonationDate || "").localeCompare(String(a.donor.lastDonationDate || "")))
    .slice(0, 5);

  const queue = pending
    .map(describe)
    .sort((a, b) => dateValue(a.donor.appliedForDonorAt) - dateValue(b.donor.appliedForDonorAt));

  const selected = rows.find((r) => r.donor.id === selectedId) || null;

  const update = (changes) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );

  const flash = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 6000);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D91E2A]">Donor network</p>
        <h1 className="mt-1 text-2xl font-extrabold text-gray-900">Donors</h1>
        <p className="mt-1 text-sm text-gray-500">Track eligibility, verify new applicants, and recognize lifetime donors across Sorsogon.</p>
      </div>

      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
          <LuCheck size={16} className="shrink-0 text-emerald-600" /> {notice}
        </div>
      )}
      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total donors" value={loading ? "—" : kpis.total} note="Activated after screening and collection" icon={<LuUsers size={20} />} tone="bg-gray-100 text-gray-700" onClick={() => update({ eligibility: "" })} />
        <Kpi featured label="Eligible to donate now" value={loading ? "—" : kpis.available} note="Interval ended and PRC clearance recorded" icon={<LuHeartPulse size={20} />} onClick={() => update({ eligibility: "available" })} />
        <Kpi
          label="Cooldown / deferred"
          value={loading ? "—" : kpis.interval + kpis.hold}
          note={loading ? "" : `${kpis.interval} on interval · ${kpis.hold} on hold or awaiting review`}
          icon={<LuHourglass size={20} />}
          tone="bg-amber-100 text-amber-700"
          onClick={() => update({ eligibility: "on_interval" })}
        />
        <Kpi
          label="Pending verification"
          value={loading ? "—" : queue.length}
          note="Applications waiting for an ID check"
          icon={<LuIdCard size={20} />}
          tone="bg-sky-100 text-sky-700"
          onClick={() => document.getElementById("pending-verification")?.scrollIntoView({ behavior: "smooth" })}
        />
      </div>

      <div className="flex flex-col items-start gap-5 lg:flex-row">
        <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs lg:w-[65%]" aria-label="Donors">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Blood type">
              {["", ...BLOOD_TYPES].map((type) => (
                <button
                  key={type || "all"}
                  onClick={() => update({ type })}
                  aria-pressed={filters.bloodType === type}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    filters.bloodType === type ? "bg-[#D91E2A] text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:text-[#D91E2A]"
                  }`}
                >
                  {type || "All"}
                </button>
              ))}
            </div>
            <div className="flex w-full flex-wrap gap-2">
              <label className="relative min-w-40 flex-1">
                <span className="sr-only">Search donors</span>
                <LuSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => update({ q: e.target.value })}
                  placeholder="Name, donor ID or barangay"
                  className="w-full rounded-xl border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-[#D91E2A] focus:outline-none"
                />
              </label>
              <select aria-label="Municipality" value={filters.municipality} onChange={(e) => update({ muni: e.target.value })} className={selectClasses}>
                <option value="">All municipalities</option>
                {SORSOGON_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select aria-label="Eligibility" value={filters.eligibility} onChange={(e) => update({ eligibility: e.target.value })} className={selectClasses}>
                {ELIGIBILITY.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3">Donor</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Municipality / Barangay</th>
                  <th className="px-3 py-3 text-right">Donations</th>
                  <th className="px-3 py-3">Eligibility</th>
                  <th className="px-3 py-3">Last donation</th>
                  <th className="w-8 px-2 py-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading donors...</td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No active donors match these filters.</td></tr>
                ) : (
                  visible.map((r) => {
                    const isSelected = r.donor.id === selectedId;
                    return (
                      <tr
                        key={r.donor.id}
                        onClick={() => update({ donor: r.donor.id })}
                        aria-selected={isSelected}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-red-50/70" : "hover:bg-gray-50"}`}
                      >
                        <td className={`border-l-[3px] px-4 py-3 ${isSelected ? "border-[#D91E2A]" : "border-transparent"}`}>
                          <p className="max-w-[200px] truncate text-[13px] font-semibold text-gray-900">{r.name}</p>
                          <p className="font-mono text-[10px] text-gray-400">#{r.donor.id.slice(0, 6).toUpperCase()}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-block min-w-9 rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-center text-[11px] font-extrabold text-[#D91E2A]">{r.donor.bloodType || "?"}</span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-gray-800">{r.municipality || "Not set"}</p>
                          <p className="text-[11px] text-gray-400">{r.barangay || "—"}</p>
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-gray-900">{r.donations}</td>
                        <td className="px-3 py-3">
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${AVAILABILITY_STYLES[r.availability.key]}`}>{r.availability.label}</span>
                          {r.availability.key === "on_interval" && (
                            <p className="mt-0.5 text-[10px] text-gray-400">until {dateOf(r.donor.nextEligibleDonationDate)}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-600">{dateOf(r.donor.lastDonationDate || r.donor.collection?.date)}</td>
                        <td className="px-2 py-3 text-gray-300"><LuChevronRight size={16} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="w-full min-w-0 space-y-4 lg:sticky lg:top-20 lg:w-[35%]">
          {selected && (
            <SelectedDonor
              row={selected}
              today={today}
              onAction={(action) => setModal({ donor: selected.donor, action })}
              onClose={() => update({ donor: "" })}
            />
          )}

          <div id="pending-verification">
            <PendingVerificationQueue items={queue} submissions={submissions} adminUser={currentUser} onDone={flash} />
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
            <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <LuAward size={14} className="text-amber-500" /> Top lifetime donors
            </h2>
            {topDonors.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">No donations recorded yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {topDonors.map((r, index) => (
                  <li key={r.donor.id}>
                    <button onClick={() => update({ donor: r.donor.id })} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-gray-50">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black ${index === 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-gray-900">{r.name}</span>
                        <span className="block text-[10px] text-gray-400">{r.donor.bloodType} · {r.municipality || "Sorsogon"}</span>
                      </span>
                      <span className="text-sm font-black tabular-nums text-[#D91E2A]">{r.donations}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      {modal && (
        <AvailabilityModal
          donor={modal.donor}
          action={modal.action}
          onClose={() => setModal(null)}
          onSaved={(message) => {
            setModal(null);
            flash(message);
          }}
        />
      )}
    </div>
  );
}

function dateValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
