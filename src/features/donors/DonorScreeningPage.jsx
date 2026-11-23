
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  HeartPulse,
  ShieldCheck,
  Clock3,
  XCircle,
} from "lucide-react";

import { useAuth } from "../../context/useAuth";
import LoadingSpinner from "../../components/common/LoadingSpinner";

import {
  activateDonor,
  saveDonorCollection,
  saveDonorScreening,
  subscribeToScreeningDonors,
} from "../../services/firestore/donorService";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function nameOf(donor) {
  return (
    donor.fullName ||
    donor.userName ||
    [donor.lastName, donor.firstName, donor.middleName]
      .filter(Boolean)
      .join(", ") ||
    donor.displayName ||
    "Unnamed donor"
  );
}

function formatStatus(value) {
  if (!value) return "Not recorded";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function localToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function StatusBadge({ status, type = "default" }) {
  const styles = {
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
    default: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
        styles[type] || styles.default
      }`}
    >
      {formatStatus(status)}
    </span>
  );
}

function Requirement({ completed, children }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {completed ? (
        <CheckCircle2
          size={17}
          className="mt-0.5 shrink-0 text-emerald-600"
        />
      ) : (
        <Clock3
          size={17}
          className="mt-0.5 shrink-0 text-gray-400"
        />
      )}

      <span className={completed ? "text-gray-800" : "text-gray-500"}>
        {children}
      </span>
    </div>
  );
}

// --------------------------------------------------
// Main Page
// --------------------------------------------------

export default function DonorScreeningPage() {
  const { currentUser } = useAuth();

  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState("");
  const [forms, setForms] = useState({});

  // ------------------------------------------------
  // Firestore Subscription
  // ------------------------------------------------

  useEffect(() => {
    const unsubscribe = subscribeToScreeningDonors(
      (items) => {
        setDonors(items);
        setLoading(false);
      },
      (err) => {
        console.error("Screening subscription error:", err);
        setError(
          "Unable to load screening records. Check Firestore permissions."
        );
        setLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // ------------------------------------------------
  // Form State
  // ------------------------------------------------

  function updateForm(donorId, field, value) {
    setForms((previous) => ({
      ...previous,
      [donorId]: {
        ...(previous[donorId] || {}),
        [field]: value,
      },
    }));
  }

  // ------------------------------------------------
  // Firestore Actions
  // ------------------------------------------------

  async function runAction(donor, action) {
    if (!currentUser?.uid) {
      setError("Administrator authentication is required.");
      return;
    }

    if (busyId) return;

    setBusyId(donor.id);
    setError("");
    setSuccess("");

    try {
      const form = forms[donor.id] || {};

      const appointmentDone =
        donor.appointmentStatus === "completed";

      const screeningDone =
        donor.screeningStatus === "completed" &&
        donor.screening?.result === "eligible";

      const collectionDone =
        donor.collectionStatus === "completed" &&
        donor.collection?.status === "completed";

      const active =
        donor.donorActivationStatus === "active";

      let result;

      // --------------------------------------------
      // 1. Medical Screening
      // --------------------------------------------

      if (action === "screening") {
        if (!appointmentDone) {
          throw new Error(
            "Complete the donor appointment before screening."
          );
        }

        if (active) {
          throw new Error(
            "This donor is already activated."
          );
        }

        if (collectionDone) {
          throw new Error(
            "Screening cannot be changed after a completed collection."
          );
        }

        if (!form.screeningResult) {
          throw new Error(
            "Please select a medical screening result."
          );
        }

        if (
          ["deferred", "ineligible"].includes(
            form.screeningResult
          ) &&
          !form.screeningNotes?.trim()
        ) {
          throw new Error(
            "Please provide a reason for deferral or ineligibility."
          );
        }

        result = await saveDonorScreening(
          donor.id,
          {
            result: form.screeningResult,
            notes: form.screeningNotes?.trim() || "",
          },
          currentUser
        );
      }

      // --------------------------------------------
      // 2. Blood Collection
      // --------------------------------------------

      else if (action === "collection") {
        if (!appointmentDone || !screeningDone) {
          throw new Error(
            "A completed appointment and eligible screening are required."
          );
        }

        if (active || collectionDone) {
          throw new Error(
            "A completed collection record cannot be overwritten here."
          );
        }

        if (!form.collectionDate) {
          throw new Error(
            "Please select the actual blood collection date."
          );
        }

        if (form.collectionDate > localToday()) {
          throw new Error(
            "Collection date cannot be in the future."
          );
        }

        const units = Number(form.units);

        if (
          !Number.isInteger(units) ||
          units < 1 ||
          units > 3
        ) {
          throw new Error(
            "Enter a valid collection quantity between 1 and 3."
          );
        }

        result = await saveDonorCollection(
          donor.id,
          {
            date: form.collectionDate,
            units,
            notes: form.collectionNotes?.trim() || "",
          },
          currentUser
        );
      }

      // --------------------------------------------
      // 3. Donor Activation
      // --------------------------------------------

      else if (action === "activate") {
        if (active) {
          throw new Error(
            "This donor is already activated."
          );
        }

        if (
          !appointmentDone ||
          !screeningDone ||
          !collectionDone
        ) {
          throw new Error(
            "Complete appointment, screening, and collection before activation."
          );
        }

        result = await activateDonor(
          donor.id,
          currentUser
        );
      } else {
        throw new Error("Unknown donor action.");
      }

      if (!result?.success) {
        throw new Error(
          result?.error || "Unable to complete the action."
        );
      }

      const messages = {
        screening: "Screening result saved successfully.",
        collection: "Blood collection recorded successfully.",
        activate: "Donor activated successfully.",
      };

      setSuccess(`${nameOf(donor)}: ${messages[action]}`);

      if (action === "screening") {
        updateForm(donor.id, "screeningResult", "");
      }
    } catch (err) {
      console.error("Donor action failed:", err);

      setError(
        `${nameOf(donor)}: ${
          err.message || "An unexpected error occurred."
        }`
      );
    } finally {
      setBusyId("");
    }
  }

  // ------------------------------------------------
  // Loading State
  // ------------------------------------------------

  if (loading) {
    return <LoadingSpinner />;
  }

  // ------------------------------------------------
  // Page
  // ------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* Header */}

      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-purple-50 p-3 text-purple-700">
          <HeartPulse size={25} />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Screening & Collection
          </h1>

          <p className="text-sm text-gray-500">
            Manage medical screening, donation collection,
            and donor activation.
          </p>
        </div>
      </header>

      {/* Error Message */}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle size={19} className="shrink-0" />

          <p>{error}</p>

          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto"
            aria-label="Dismiss error"
          >
            <XCircle size={18} />
          </button>
        </div>
      )}

      {/* Success Message */}

      {success && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <CheckCircle2 size={19} className="shrink-0" />

          <p>{success}</p>

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="ml-auto"
            aria-label="Dismiss success message"
          >
            <XCircle size={18} />
          </button>
        </div>
      )}

      {/* Empty State */}

      {donors.length === 0 ? (
        <div className="rounded-2xl border bg-white p-12 text-center">
          <ClipboardCheck
            size={38}
            className="mx-auto text-gray-300"
          />

          <h2 className="mt-4 font-semibold text-gray-900">
            No applicants available for screening
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Approved applicants with scheduled or completed
            appointments will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {donors.map((donor) => {
            const form = forms[donor.id] || {};

            const appointmentDone =
              donor.appointmentStatus === "completed";

            const screeningDone =
              donor.screeningStatus === "completed" &&
              donor.screening?.result === "eligible";

            const collectionDone =
              donor.collectionStatus === "completed" &&
              donor.collection?.status === "completed";

            const active =
              donor.donorActivationStatus === "active";

            const deferred =
              donor.screening?.result === "deferred";

            const ineligible =
              donor.screening?.result === "ineligible";

            const isBusy = busyId === donor.id;

            const canScreen =
              appointmentDone &&
              !active &&
              !collectionDone;

            const canCollect =
              appointmentDone &&
              screeningDone &&
              !collectionDone &&
              !active;

            const canActivate =
              appointmentDone &&
              screeningDone &&
              collectionDone &&
              !active;

            return (
              <article
                key={donor.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
              >
                {/* Donor Information */}

                <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {nameOf(donor)}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Blood Type:{" "}
                      <strong>
                        {donor.bloodType || "N/A"}
                      </strong>
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Appointment:{" "}
                      {formatStatus(
                        donor.appointmentStatus ||
                          "not scheduled"
                      )}
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      active
                        ? "Active Donor"
                        : deferred
                        ? "Deferred"
                        : ineligible
                        ? "Ineligible"
                        : collectionDone
                        ? "Collection Completed"
                        : screeningDone
                        ? "Screening Completed"
                        : appointmentDone
                        ? "Ready for Screening"
                        : "Awaiting Appointment"
                    }
                    type={
                      active
                        ? "success"
                        : ineligible
                        ? "danger"
                        : deferred
                        ? "warning"
                        : collectionDone || screeningDone
                        ? "info"
                        : "default"
                    }
                  />
                </div>

                {/* Workflow Sections */}

                <div className="grid gap-4 p-5 lg:grid-cols-3">
                  {/* ----------------------------------
                      1. Screening
                  ---------------------------------- */}

                  <section className="space-y-4 rounded-xl border border-purple-100 bg-purple-50/40 p-4">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck
                        size={20}
                        className="text-purple-700"
                      />

                      <h3 className="font-bold text-gray-900">
                        1. Medical Screening
                      </h3>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">
                        Current screening result
                      </p>

                      <StatusBadge
                        status={
                          donor.screening?.result ||
                          "Not recorded"
                        }
                        type={
                          screeningDone
                            ? "success"
                            : deferred
                            ? "warning"
                            : ineligible
                            ? "danger"
                            : "default"
                        }
                      />
                    </div>

                    <label className="block text-sm font-medium text-gray-700">
                      Professional screening result

                      <select
                        value={form.screeningResult || ""}
                        onChange={(event) =>
                          updateForm(
                            donor.id,
                            "screeningResult",
                            event.target.value
                          )
                        }
                        disabled={!canScreen || !!busyId}
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 disabled:opacity-50"
                      >
                        <option value="" disabled>
                          Select screening result
                        </option>

                        <option value="eligible">
                          Eligible
                        </option>

                        <option value="deferred">
                          Temporarily Deferred
                        </option>

                        <option value="ineligible">
                          Ineligible
                        </option>
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                      Screening notes

                      <textarea
                        rows={3}
                        value={form.screeningNotes || ""}
                        onChange={(event) =>
                          updateForm(
                            donor.id,
                            "screeningNotes",
                            event.target.value
                          )
                        }
                        disabled={!canScreen || !!busyId}
                        placeholder="Record medical screening observations or deferral reasons..."
                        className="mt-2 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 disabled:opacity-50"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={!!busyId || !canScreen}
                      onClick={() =>
                        runAction(donor, "screening")
                      }
                      className="w-full rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isBusy
                        ? "Saving..."
                        : donor.screeningStatus
                        ? "Update Screening"
                        : "Save Screening Result"}
                    </button>

                    {!appointmentDone && (
                      <p className="text-xs text-amber-700">
                        Complete the donor appointment before
                        recording screening.
                      </p>
                    )}

                    {collectionDone && (
                      <p className="text-xs text-gray-500">
                        Screening is locked after a completed
                        collection.
                      </p>
                    )}
                  </section>

                  {/* ----------------------------------
                      2. Blood Collection
                  ---------------------------------- */}

                  <section className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                    <div className="flex items-center gap-2">
                      <Droplets
                        size={20}
                        className="text-blue-700"
                      />

                      <h3 className="font-bold text-gray-900">
                        2. Blood Collection
                      </h3>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">
                        Collection status
                      </p>

                      <StatusBadge
                        status={
                          donor.collectionStatus ||
                          "Not recorded"
                        }
                        type={
                          collectionDone
                            ? "success"
                            : "default"
                        }
                      />
                    </div>

                    <label className="block text-sm font-medium text-gray-700">
                      Actual collection date

                      <input
                        type="date"
                        max={localToday()}
                        value={form.collectionDate || ""}
                        onChange={(event) =>
                          updateForm(
                            donor.id,
                            "collectionDate",
                            event.target.value
                          )
                        }
                        disabled={!canCollect || !!busyId}
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                      Collection quantity (units)

                      <input
                        type="number"
                        min="1"
                        max="3"
                        step="1"
                        value={form.units || ""}
                        onChange={(event) =>
                          updateForm(
                            donor.id,
                            "units",
                            event.target.value
                          )
                        }
                        disabled={!canCollect || !!busyId}
                        placeholder="Enter recorded quantity"
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </label>

                    <p className="text-xs text-gray-500">
                      Record the quantity using your PRC-approved
                      collection documentation. This field does not
                      represent transfusion-ready blood units.
                    </p>

                    <label className="block text-sm font-medium text-gray-700">
                      Collection notes

                      <textarea
                        rows={3}
                        value={form.collectionNotes || ""}
                        onChange={(event) =>
                          updateForm(
                            donor.id,
                            "collectionNotes",
                            event.target.value
                          )
                        }
                        disabled={!canCollect || !!busyId}
                        placeholder="Enter collection details..."
                        className="mt-2 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={!!busyId || !canCollect}
                      onClick={() =>
                        runAction(donor, "collection")
                      }
                      className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isBusy
                        ? "Saving..."
                        : collectionDone
                        ? "Collection Recorded"
                        : "Record Collection"}
                    </button>

                    {!screeningDone && (
                      <p className="text-xs text-amber-700">
                        Eligible medical screening is required
                        before collection.
                      </p>
                    )}

                    {collectionDone && (
                      <p className="text-xs text-emerald-700">
                        Collection completed. This record is
                        locked in the form.
                      </p>
                    )}
                  </section>

                  {/* ----------------------------------
                      3. Donor Activation
                  ---------------------------------- */}

                  <section className="space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        size={20}
                        className="text-emerald-700"
                      />

                      <h3 className="font-bold text-gray-900">
                        3. Donor Activation
                      </h3>
                    </div>

                    <p className="text-sm text-gray-600">
                      Review the required records before
                      activating this donor.
                    </p>

                    <div className="space-y-3 rounded-lg bg-white p-4">
                      <Requirement completed={appointmentDone}>
                        Appointment completed
                      </Requirement>

                      <Requirement completed={screeningDone}>
                        Eligible screening recorded
                      </Requirement>

                      <Requirement completed={collectionDone}>
                        Blood collection completed
                      </Requirement>
                    </div>

                    <button
                      type="button"
                      disabled={!!busyId || !canActivate}
                      onClick={() =>
                        runAction(donor, "activate")
                      }
                      className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isBusy
                        ? "Saving..."
                        : active
                        ? "Donor Activated"
                        : "Activate Donor"}
                    </button>

                    {active ? (
                      <div className="rounded-lg bg-emerald-100 p-3 text-xs text-emerald-800">
                        <CheckCircle2
                          size={16}
                          className="mb-1"
                        />

                        Donor registration is active. Donation
                        availability must still be checked
                        separately.
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Activation is separate from application
                        approval and medical screening.
                      </p>
                    )}
                  </section>
                </div>

                {/* Existing Records */}

                {(donor.screening?.notes ||
                  donor.collection?.date) && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <h4 className="mb-2 text-sm font-semibold text-gray-800">
                      Recorded Information
                    </h4>

                    <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                      {donor.screening?.notes && (
                        <p>
                          <strong>Screening Notes:</strong>{" "}
                          {donor.screening.notes}
                        </p>
                      )}

                      {donor.collection?.date && (
                        <p>
                          <strong>Collection Date:</strong>{" "}
                          {donor.collection.date}
                        </p>
                      )}

                      {donor.collection?.units != null && (
                        <p>
                          <strong>Recorded Quantity:</strong>{" "}
                          {donor.collection.units}
                        </p>
                      )}

                      {donor.collection?.notes && (
                        <p>
                          <strong>Collection Notes:</strong>{" "}
                          {donor.collection.notes}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Footer Notice */}

      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <AlertCircle
          size={18}
          className="mt-0.5 shrink-0 text-gray-500"
        />

        <p className="text-xs leading-relaxed text-gray-600">
          Screening and collection records must reflect actual
          procedures performed by authorized PRC personnel.
          Recording a donation does not certify collected blood
          as safe for transfusion. Donor availability, medical
          deferrals, and donation intervals must be managed
          separately.
        </p>
      </div>
    </div>
  );
}
