import { useState } from "react";
import { Link } from "react-router-dom";
import { LuCheck, LuIdCard, LuX } from "react-icons/lu";
import { SecureFileLink, SecureImage } from "../../components/common/SecureFile";
import { updateDonorStatus } from "../../services/firestore/donorService";
import { dateOf } from "./donorAvailability";

const hasBothIdPhotos = (submission) =>
  Boolean(submission?.frontIdImageUrl?.trim?.() && submission?.backIdImageUrl?.trim?.());

function QueueItem({ item, submission, adminUser, onDone }) {
  const [mode, setMode] = useState(null); // "verify" | "decline"
  const [reason, setReason] = useState("");
  const [reapply, setReapply] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loadingId = submission === undefined;
  const hasId = hasBothIdPhotos(submission);

  const submit = async (status) => {
    setBusy(true);
    setError("");
    // Same call as Donor Applications: the backend worker notifies the
    // applicant once it sees the new applicationStatus.
    const result = await updateDonorStatus(item.donor.id, status, adminUser, reason, status === "rejected" ? reapply : null);
    setBusy(false);
    if (!result.success) {
      setError(result.error || "Could not update the application.");
      return;
    }
    onDone(status === "approved" ? `${item.name} was verified and approved. Next: schedule their appointment.` : `${item.name}'s application was declined.`);
  };

  return (
    <li className="space-y-2.5 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
          <p className="truncate text-[11px] text-gray-500">
            Applied {dateOf(item.donor.appliedForDonorAt || item.donor.createdAt)}
            {item.municipality ? ` · ${item.municipality}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-[#D91E2A]">
          {item.donor.bloodType || "?"}
        </span>
      </div>

      {loadingId ? (
        <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
      ) : hasId ? (
        <div className="grid grid-cols-2 gap-2">
          {[["Front ID", submission.frontIdImageUrl], ["Back ID", submission.backIdImageUrl]].map(([label, value]) => (
            <SecureFileLink key={label} value={value} className="block">
              <SecureImage value={value} alt={`${item.name} ${label}`} className="h-20 w-full rounded-lg border border-gray-200 bg-gray-50 object-cover" />
              <span className="mt-0.5 block text-[10px] font-semibold text-gray-500">{label} · open</span>
            </SecureFileLink>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
          <LuIdCard size={14} /> No complete ID on file. Use the full review in Donor Applications.
        </p>
      )}

      {mode === "decline" && (
        <div className="space-y-2 rounded-lg border border-rose-100 bg-rose-50/50 p-2.5">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Reason shown to the applicant"
            aria-label="Reason shown to the applicant"
            className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-rose-500 focus:outline-none"
          />
          <fieldset className="flex items-center gap-3 text-[11px] text-gray-700">
            <legend className="sr-only">May they apply again?</legend>
            <span className="font-semibold">May reapply?</span>
            {[["Yes", true], ["No", false]].map(([label, value]) => (
              <label key={label} className="flex items-center gap-1">
                <input type="radio" name={`reapply-${item.donor.id}`} checked={reapply === value} onChange={() => setReapply(value)} className="accent-rose-600" />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
      )}

      {error && <p role="alert" className="text-[11px] font-semibold text-rose-700">{error}</p>}

      <div className="flex gap-2">
        {mode === null && (
          <>
            <button
              onClick={() => setMode("verify")}
              disabled={!hasId}
              title={hasId ? "Approve this donor application" : "No complete ID on file"}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              <LuCheck size={13} /> Verify
            </button>
            <button
              onClick={() => setMode("decline")}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-200 px-2 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
            >
              <LuX size={13} /> Decline
            </button>
          </>
        )}
        {mode === "verify" && (
          <button
            onClick={() => submit("approved")}
            disabled={busy}
            className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Approving..." : "Confirm: ID matches, approve application"}
          </button>
        )}
        {mode === "decline" && (
          <button
            onClick={() => submit("rejected")}
            disabled={busy || !reason.trim() || reapply === null}
            className="flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? "Declining..." : "Confirm decline"}
          </button>
        )}
        {mode !== null && (
          <button onClick={() => { setMode(null); setError(""); }} disabled={busy} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-100">
            Cancel
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Donor applications waiting for PRC: the applicant's ID photos (private
 * files, shown through signed links) with Verify (approve) and Decline.
 */
export default function PendingVerificationQueue({ items, submissions, adminUser, onDone }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-[#F8F9FB] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Pending verification <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-amber-800">{items.length}</span>
        </h2>
        <Link to="/donors" className="text-[11px] font-semibold text-[#D91E2A] hover:underline">Full review</Link>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">No applications are waiting for verification.</p>
      ) : (
        <ul className="max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
          {items.map((item) => (
            <QueueItem key={item.donor.id} item={item} submission={submissions[item.uid]} adminUser={adminUser} onDone={onDone} />
          ))}
        </ul>
      )}
    </section>
  );
}
