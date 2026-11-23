import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { auth } from "../../firebase/config";
import { updateDonorAvailability } from "../../services/firestore/donorService";
import { dateOf, nameOf } from "./donorAvailability";

/**
 * PRC records a donor's availability: mark available (after the donation
 * interval, with clearance), place on medical hold, or review a hold.
 * action: "available" | "medical_hold" | "lift_hold"
 */
export default function AvailabilityModal({
  donor,
  action,
  onClose,
  onSaved,
}) {
  const [notes, setNotes] = useState("");
  const [clearanceConfirmed, setClearanceConfirmed] =
    useState(false);
  const [donorConfirmed, setDonorConfirmed] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isAvailable = action === "available";
  const isLiftingHold = action === "lift_hold";
  const isMedicalHold = action === "medical_hold";

  const previousReview = donor.availabilityReview || {};

  const modalTitle = isAvailable
    ? "Mark Donor Available"
    : isLiftingHold
      ? "Review Medical Hold"
      : "Place Donor on Medical Hold";

  const notesLabel = isAvailable
    ? "PRC Clearance Reference / Notes"
    : isLiftingHold
      ? "Reason for Lifting Medical Hold"
      : "Medical Hold Reason";

  const notesPlaceholder = isAvailable
    ? "Enter PRC clearance reference and donor confirmation details..."
    : isLiftingHold
      ? "Explain why PRC has decided to lift this medical hold..."
      : "Enter the reason for placing this donor on medical hold...";

  const submitLabel = isAvailable
    ? "Confirm Available"
    : isLiftingHold
      ? "Confirm Lift Medical Hold"
      : "Confirm Medical Hold";

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    if (!notes.trim()) {
      setError(
        isAvailable
          ? "PRC clearance notes are required."
          : isLiftingHold
            ? "A reason for lifting the hold is required."
            : "A medical hold reason is required."
      );
      return;
    }

    if (
      isAvailable &&
      (!clearanceConfirmed || !donorConfirmed)
    ) {
      setError(
        "Confirm both PRC medical clearance and donor availability."
      );
      return;
    }

    const adminUser = auth.currentUser;

    if (!adminUser?.uid) {
      setError("Administrator session is unavailable.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await updateDonorAvailability(
        donor.id,
        {
          status: action,
          notes: notes.trim(),
          prcClearanceConfirmed:
            isAvailable && clearanceConfirmed,
          donorAvailabilityConfirmed:
            isAvailable && donorConfirmed,
        },
        adminUser
      );

      if (!result.success) {
        throw new Error(
          result.error || "Could not update donor availability."
        );
      }

      const message = isAvailable
        ? `${nameOf(donor)} was marked available.`
        : isLiftingHold
          ? `Medical Hold lifted for ${nameOf(donor)}. PRC clearance is still required before donation.`
          : `${nameOf(donor)} was placed on Medical Hold.`;

      onSaved(
        result.warning
          ? `${message} ${result.warning}`
          : message
      );
    } catch (err) {
      setError(
        err.message || "Unable to update donor availability."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="availability-modal-title"
              className="text-xl font-bold text-gray-900"
            >
              {modalTitle}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {nameOf(donor)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* DONOR INFORMATION */}
        <div className="mt-5 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
          <p>
            <span className="text-gray-500">
              Blood Type:
            </span>{" "}
            <strong>{donor.bloodType || "N/A"}</strong>
          </p>

          <p>
            <span className="text-gray-500">
              Last Donation:
            </span>{" "}
            {dateOf(
              donor.lastDonationDate ||
              donor.collection?.date
            )}
          </p>

          <p>
            <span className="text-gray-500">
              Next Interval Date:
            </span>{" "}
            {dateOf(donor.nextEligibleDonationDate)}
          </p>
        </div>

        {/* EXISTING HOLD INFORMATION */}
        {isLiftingHold && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <ShieldAlert size={18} />
              <p className="text-sm font-semibold">
                Existing Medical Hold
              </p>
            </div>

            <p className="mt-2 text-sm text-blue-900">
              <strong>Previous reason:</strong>{" "}
              {previousReview.notes ||
                "No previous reason recorded."}
            </p>

            <p className="mt-2 text-xs text-blue-700">
              Reviewed by:{" "}
              {previousReview.reviewedBy || "Not recorded"}
            </p>
          </div>
        )}

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-4"
        >
          {/* MARK AVAILABLE CONFIRMATIONS */}
          {isAvailable && (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={clearanceConfirmed}
                  onChange={(event) =>
                    setClearanceConfirmed(
                      event.target.checked
                    )
                  }
                  disabled={saving}
                  className="mt-1"
                />

                <span>
                  I confirm that PRC has reviewed and
                  recorded the required medical clearance
                  for this donor.
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={donorConfirmed}
                  onChange={(event) =>
                    setDonorConfirmed(
                      event.target.checked
                    )
                  }
                  disabled={saving}
                  className="mt-1"
                />

                <span>
                  I confirm that the donor has indicated
                  they are currently available to donate.
                </span>
              </label>
            </div>
          )}

          {/* MEDICAL HOLD NOTICE */}
          {isMedicalHold && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Placing this donor on Medical Hold prevents
              them from being displayed as available until
              PRC reviews and lifts the restriction.
            </div>
          )}

          {/* LIFT HOLD NOTICE */}
          {isLiftingHold && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Lifting this hold does not automatically make
              the donor available. The donation interval
              and PRC clearance requirements still apply.
            </div>
          )}

          {/* NOTES */}
          <div>
            <label
              htmlFor="availability-notes"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              {notesLabel}
            </label>

            <textarea
              id="availability-notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              rows={4}
              maxLength={1000}
              disabled={saving}
              placeholder={notesPlaceholder}
              className="w-full resize-none rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-emerald-500 disabled:bg-gray-100"
            />
          </div>

          {/* ERROR */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle
                size={18}
                className="shrink-0"
              />

              <span>{error}</span>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                !notes.trim() ||
                (isAvailable &&
                  (!clearanceConfirmed ||
                    !donorConfirmed))
              }
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${isAvailable
                ? "bg-emerald-600 hover:bg-emerald-700"
                : isLiftingHold
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-amber-600 hover:bg-amber-700"
                }`}
            >
              {saving ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : isAvailable ? (
                <CheckCircle2 size={16} />
              ) : isLiftingHold ? (
                <ShieldCheck size={16} />
              ) : (
                <ShieldAlert size={16} />
              )}

              {saving ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
