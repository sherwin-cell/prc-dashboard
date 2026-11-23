
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  HeartPulse,
  Search,
  Users,
  Clock3,
  CalendarDays,
  ShieldCheck,
  Activity,
  Droplets,
  CheckCircle2,
  ShieldAlert,
  X,
  Loader2,
} from "lucide-react";

import LoadingSpinner from "../../components/common/LoadingSpinner";

import { auth } from "../../firebase/config";

import {
  subscribeToActiveDonors,
  updateDonorAvailability,
} from "../../services/firestore/donorService";

// =====================================================
// HELPERS
// =====================================================

function nameOf(donor) {
  const fullName = [
    donor.firstName,
    donor.middleName,
    donor.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    donor.fullName ||
    donor.userName ||
    fullName ||
    donor.displayName ||
    "Unnamed donor"
  );
}

function dateOf(value) {
  if (!value) return "N/A";

  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (match) {
      return `${match[2]}/${match[3]}/${match[1]}`;
    }
  }

  let date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (typeof value.seconds === "number") {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }

  return Number.isNaN(date.getTime())
    ? "N/A"
    : date.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
    });
}

function todayPhilippines() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function validDateString(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// =====================================================
// AVAILABILITY LOGIC
// =====================================================


function getAvailability(donor, today) {
  const status = String(
    donor.donationAvailabilityStatus || ""
  ).toLowerCase();

  const nextDate = donor.nextEligibleDonationDate;

  // 1. Medical Hold always takes priority.
  // Even if the donor is still within the donation interval,
  // the administrator must see the medical hold status.
  if (status === "medical_hold") {
    return {
      key: "medical_hold",
      label: "Medical Hold",
      description: "PRC has placed this donor on hold",
    };
  }

  // 2. Check whether the interval date is valid.
  if (!validDateString(nextDate)) {
    return {
      key: "medical_hold",
      label: "Review Required",
      description: "Missing or invalid interval date",
    };
  }

  // 3. Donor is still within the required donation interval.
  if (today < nextDate) {
    return {
      key: "on_interval",
      label: "On Donation Interval",
      description: `Next interval: ${dateOf(nextDate)}`,
    };
  }

  // 4. Donation interval has ended,
  // but PRC clearance has not yet been recorded.
  if (status === "on_interval") {
    return {
      key: "medical_hold",
      label: "Awaiting Clearance",
      description: "Donation interval completed. PRC review required.",
    };
  }

  // 5. Verify that PRC explicitly recorded clearance.
  if (status === "available") {
    const review = donor.availabilityReview;

    const hasRecordedClearance =
      review?.status === "available" &&
      review?.clearanceConfirmed === true &&
      review?.donorAvailabilityConfirmed === true &&
      typeof review?.notes === "string" &&
      review.notes.trim().length > 0 &&
      Boolean(review?.reviewedBy) &&
      Boolean(review?.reviewedAt);

    if (hasRecordedClearance) {
      return {
        key: "available",
        label: "Available",
        description: "PRC clearance recorded",
      };
    }

    return {
      key: "medical_hold",
      label: "Review Required",
      description: "PRC clearance record missing or incomplete",
    };
  }

  // 6. Handle unknown or missing availability statuses.
  return {
    key: "medical_hold",
    label: "Review Required",
    description: "Donor availability has not been confirmed",
  };
}


// =====================================================
// COMPONENTS
// =====================================================

function AvailabilityBadge({ availability }) {
  const styles = {
    available: "bg-emerald-100 text-emerald-800",
    on_interval: "bg-amber-100 text-amber-800",
    medical_hold: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="space-y-1">
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[availability.key] || styles.medical_hold
          }`}
      >
        {availability.label}
      </span>

      <p className="max-w-48 text-xs text-gray-500">
        {availability.description}
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div
        className={`rounded-xl p-3 ${tones[tone] || tones.blue
          }`}
      >
        <Icon size={23} />
      </div>

      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">
          {value}
        </p>
      </div>
    </div>
  );
}

// =====================================================
// PRC AVAILABILITY MODAL
// =====================================================


function AvailabilityModal({
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


// =====================================================
// ACTIVE DONORS PAGE
// =====================================================

export default function ActiveDonorsPage() {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [today, setToday] =
    useState(todayPhilippines());

  const [selectedAction, setSelectedAction] =
    useState(null);

  // Keep dates synchronized with Philippine time.
  useEffect(() => {
    const timer = setInterval(() => {
      setToday(todayPhilippines());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Real-time Firestore subscription.
  useEffect(() => {
    const unsubscribe = subscribeToActiveDonors(
      (items) => {
        setDonors(items);
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error(
          "Active donor subscription error:",
          err
        );

        setError("Unable to load active donors.");
        setLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const donorRecords = useMemo(
    () =>
      donors.map((donor) => ({
        ...donor,
        availability: getAvailability(donor, today),
      })),
    [donors, today]
  );

  const stats = useMemo(
    () => ({
      total: donorRecords.length,

      available: donorRecords.filter(
        (donor) =>
          donor.availability.key === "available"
      ).length,

      onInterval: donorRecords.filter(
        (donor) =>
          donor.availability.key === "on_interval"
      ).length,

      review: donorRecords.filter(
        (donor) =>
          donor.availability.key === "medical_hold"
      ).length,
    }),
    [donorRecords]
  );

  const filtered = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return donorRecords.filter((donor) => {
      const searchable = [
        nameOf(donor),
        donor.email,
        donor.userEmail,
        donor.bloodType,
        donor.phoneNumber,
        donor.mobileNo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchable.includes(searchText) &&
        (statusFilter === "all" ||
          donor.availability.key === statusFilter)
      );
    });
  }, [donorRecords, search, statusFilter]);

  function openAction(donor, action) {
    setSuccess("");
    setSelectedAction({ donor, action });
  }

  function handleSaved(message) {
    setSelectedAction(null);
    setSuccess(message);
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* HEADER */}
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
          <HeartPulse size={25} />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Active Donors
          </h1>

          <p className="text-sm text-gray-500">
            Monitor registered donors, donation
            intervals, and PRC availability decisions.
          </p>
        </div>
      </header>

      {/* NOTIFICATIONS */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle size={19} />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <CheckCircle2 size={19} />
          <p>{success}</p>
          <button
            type="button"
            onClick={() => setSuccess("")}
            className="ml-auto"
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* STATISTICS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Active Donors"
          value={stats.total}
          tone="purple"
        />

        <StatCard
          icon={ShieldCheck}
          label="Available Donors"
          value={stats.available}
          tone="green"
        />

        <StatCard
          icon={Clock3}
          label="On Donation Interval"
          value={stats.onInterval}
          tone="amber"
        />

        <StatCard
          icon={Activity}
          label="Needs Review"
          value={stats.review}
          tone="blue"
        />
      </div>

      {/* SEARCH AND FILTER */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search name, email, blood type, or contact..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
        >
          <option value="all">
            All Active Donors
          </option>
          <option value="available">
            Available
          </option>
          <option value="on_interval">
            On Donation Interval
          </option>
          <option value="medical_hold">
            Needs Review / Medical Hold
          </option>
        </select>
      </div>

      {/* DONORS TABLE */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <HeartPulse
              size={36}
              className="mx-auto text-gray-300"
            />

            <h2 className="mt-3 font-semibold text-gray-900">
              No matching donors found
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              {donors.length === 0
                ? "Activated donors will appear here after PRC completes the required workflow."
                : "Try adjusting your search or availability filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-4">Donor</th>
                  <th className="p-4">Blood Type</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Last Donation</th>
                  <th className="p-4">Next Interval Date</th>
                  <th className="p-4">Availability</th>
                  <th className="p-4">Activated</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filtered.map((donor) => {
                  const intervalComplete =
                    validDateString(
                      donor.nextEligibleDonationDate
                    ) &&
                    today >=
                    donor.nextEligibleDonationDate;


                  const canMarkAvailable =
                    intervalComplete &&
                    donor.donationAvailabilityStatus !== "medical_hold" &&
                    donor.availability.key !== "available";

                  const canPlaceHold =
                    donor.donationAvailabilityStatus !== "medical_hold";

                  const canReviewHold =
                    donor.donationAvailabilityStatus === "medical_hold";


                  return (
                    <tr
                      key={donor.id}
                      className="transition hover:bg-gray-50"
                    >
                      {/* DONOR */}
                      <td className="p-4">
                        <p className="font-semibold text-gray-900">
                          {nameOf(donor)}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Active Registration
                        </p>
                      </td>

                      {/* BLOOD TYPE */}
                      <td className="p-4">
                        <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 font-bold text-red-700">
                          <Droplets size={13} className="mr-1" />
                          {donor.bloodType || "N/A"}
                        </span>
                      </td>

                      {/* CONTACT */}
                      <td className="p-4 text-gray-600">
                        {donor.mobileNo ||
                          donor.phoneNumber ||
                          donor.email ||
                          donor.userEmail ||
                          "N/A"}
                      </td>

                      {/* LAST DONATION */}
                      <td className="p-4 text-gray-600">
                        {dateOf(
                          donor.lastDonationDate ||
                          donor.collection?.date
                        )}
                      </td>

                      {/* NEXT INTERVAL DATE */}
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-gray-700">
                          <CalendarDays
                            size={15}
                            className="text-gray-400"
                          />

                          {dateOf(donor.nextEligibleDonationDate)}
                        </div>
                      </td>

                      {/* AVAILABILITY */}
                      <td className="p-4">
                        <AvailabilityBadge
                          availability={donor.availability}
                        />
                      </td>

                      {/* ACTIVATED */}
                      <td className="p-4 text-gray-600">
                        {dateOf(donor.activatedAt)}
                      </td>

                      {/* ACTIONS */}
                      <td className="p-4">
                        <div className="flex min-w-40 flex-col gap-2">

                          {/* MARK AVAILABLE */}
                          <button
                            type="button"
                            onClick={() =>
                              openAction(donor, "available")
                            }
                            disabled={!canMarkAvailable}
                            title={
                              !intervalComplete
                                ? "Donation interval has not ended."
                                : "Record PRC availability clearance."
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                          >
                            <CheckCircle2 size={14} />
                            Mark Available
                          </button>

                          {/* MEDICAL HOLD */}
                          <button
                            type="button"
                            onClick={() =>
                              openAction(donor, "medical_hold")
                            }
                            disabled={!canPlaceHold}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ShieldAlert size={14} />
                            Medical Hold
                          </button>

                          {/* REVIEW MEDICAL HOLD */}
                          {canReviewHold && (
                            <button
                              type="button"
                              onClick={() =>
                                openAction(donor, "lift_hold")
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 transition hover:bg-blue-100"
                            >
                              <ShieldCheck size={14} />
                              Review Medical Hold
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

          </div>
        )}
      </div>

      {/* IMPORTANT NOTICE */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <AlertCircle
          size={18}
          className="mt-0.5 shrink-0 text-blue-700"
        />

        <p className="text-xs leading-relaxed text-blue-900">
          Active donor registration does not guarantee
          current donation eligibility. Reaching the next
          interval date does not automatically provide
          medical clearance. PRC must record a clearance
          decision, and donors must complete the required
          screening before any subsequent collection.
        </p>
      </div>

      {/* ACTION MODAL */}
      {selectedAction && (
        <AvailabilityModal
          donor={selectedAction.donor}
          action={selectedAction.action}
          onClose={() => setSelectedAction(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
