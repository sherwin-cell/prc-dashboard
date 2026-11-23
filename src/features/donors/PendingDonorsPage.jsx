
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  Eye,
  Filter,
  Search,
  Trash2,
} from "lucide-react";
import {
  subscribeToPendingDonors,
  updateDonorStatus,
  scheduleDonorAppointment,
  archiveDonorApplication,
  deleteDonorApplication,
} from "../../services/firestore/donorService";
import { canArchiveDonor, isDonorArchived } from "../../constants/statuses";

const REJECT_FIRST = "Only rejected applications can be archived or deleted.";

import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import DonorDetail from "./DonorDetail";

const BLOOD_TYPES = [
  "A+", "A-", "B+", "B-",
  "AB+", "AB-", "O+", "O-",
];

function statusOf(donor) {
  return String(
    donor.applicationStatus ||
    donor.donorStatus ||
    donor.status ||
    "pending"
  ).toLowerCase();
}

function donorName(donor) {
  if (donor.fullName) return donor.fullName;

  if (donor.lastName || donor.firstName) {
    return [
      donor.lastName,
      [donor.firstName, donor.middleName]
        .filter(Boolean)
        .join(" "),
    ]
      .filter(Boolean)
      .join(", ");
  }

  return (
    donor.userName ||
    donor.displayName ||
    "Anonymous User"
  );
}

function formatDate(value) {
  if (!value) return "N/A";

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
    : date.toLocaleDateString();
}

function StatusBadge({ status }) {
  const styles = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
    archived: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
        styles[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}

export default function PendingDonorsPage() {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDonor, setSelectedDonor] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("name");
  const [selectedBloodType, setSelectedBloodType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const { currentUser } = useAuth();

  // Subscribe to donor applications.
  useEffect(() => {
    const unsubscribe = subscribeToPendingDonors(
      (data) => {
        setDonors(data);
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error(
          "Failed to load donor applications:",
          err
        );
        setError(
          "Failed to load donor applications. Please refresh and try again."
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // The selected donor with the latest Firestore data merged in.
  const liveSelectedDonor = useMemo(() => {
    if (!selectedDonor) return null;
    const latest = donors.find((item) => item.id === selectedDonor.id);
    return latest ? { ...selectedDonor, ...latest } : selectedDonor;
  }, [donors, selectedDonor]);

  // Approve or reject a donor application.
  const handleStatusUpdate = async (
    donorId,
    status,
    reason = "",
    reapplicationAllowed = null
  ) => {
    if (!currentUser?.uid) {
      throw new Error(
        "You must be logged in as an administrator."
      );
    }

    const result = await updateDonorStatus(
      donorId,
      status,
      currentUser,
      reason,
      reapplicationAllowed
    );

    if (!result?.success) {
      throw new Error(
        result?.error || "Could not update application."
      );
    }

    const updatedFields = {
      applicationStatus: status,
      donorStatus: status,
      status,
      reviewEventId: result.reviewEventId,
      rejectionReason:
        status === "rejected" ? reason.trim() : "",
      reapplicationAllowed:
        status === "rejected" ? reapplicationAllowed === true : false,
    };

    setDonors((previous) =>
      previous.map((item) =>
        item.id === donorId
          ? { ...item, ...updatedFields }
          : item
      )
    );

    setSelectedDonor((previous) =>
      previous?.id === donorId
        ? { ...previous, ...updatedFields }
        : previous
    );

    // No notification call here: the backend notification worker sees the
    // new applicationStatus/reviewEventId in Firestore and notifies the
    // applicant (in-app record + push) exactly once.

    return result;
  };

  // Schedule an appointment for an approved donor.
  const handleScheduleAppointment = async (appointment) => {
    if (!currentUser?.uid) {
      throw new Error(
        "You must be logged in as an administrator."
      );
    }

    if (!selectedDonor?.id) {
      throw new Error("No donor application selected.");
    }

    const donorId = selectedDonor.id;

    const result = await scheduleDonorAppointment(
      donorId,
      appointment,
      currentUser
    );

    if (!result?.success) {
      throw new Error(
        result?.error || "Could not schedule appointment."
      );
    }

    const updatedFields = {
      appointment: result.appointment,
      appointmentStatus: result.appointmentStatus,
    };

    setDonors((previous) =>
      previous.map((item) =>
        item.id === donorId
          ? { ...item, ...updatedFields }
          : item
      )
    );

    setSelectedDonor((previous) =>
      previous?.id === donorId
        ? { ...previous, ...updatedFields }
        : previous
    );

    return result;
  };

  // Search and filter donor applications.
  const filtered = useMemo(() => {
    return donors.filter((donor) => {
      const status = statusOf(donor);

      if (isDonorArchived(donor)) return false;

      if (selectedStatus && status !== selectedStatus) {
        return false;
      }

      if (
        selectedBloodType &&
        String(donor.bloodType || "").toUpperCase() !==
          selectedBloodType
      ) {
        return false;
      }

      const queryText = searchQuery.trim().toLowerCase();

      if (!queryText) return true;

      if (filterCategory === "birthday") {
        const birthday =
          typeof donor.birthday?.toDate === "function"
            ? donor.birthday.toDate().toLocaleDateString()
            : String(donor.birthday || "");

        return birthday.toLowerCase().includes(queryText);
      }

      return donorName(donor)
        .toLowerCase()
        .includes(queryText);
    });
  }, [
    donors,
    selectedStatus,
    selectedBloodType,
    searchQuery,
    filterCategory,
  ]);

  // Archive or permanently delete an application.
  const runConfirmAction = async () => {
    if (!confirmAction) return;

    if (!currentUser?.uid) {
      setError(
        "You must be logged in as an administrator."
      );
      return;
    }

    setBusy(true);
    setError("");

    const donorId = confirmAction.donor.id;
    const actionType = confirmAction.type;

    try {
      const result =
        actionType === "archive"
          ? await archiveDonorApplication(donorId, currentUser)
          : await deleteDonorApplication(donorId, currentUser);
      if (!result.success) throw new Error(result.error);

      // Archived and deleted applications both leave the list; the
      // live subscription confirms it.
      setDonors((previous) =>
        previous.filter((item) => item.id !== donorId)
      );

      if (selectedDonor?.id === donorId) {
        setSelectedDonor(null);
      }

      setConfirmAction(null);
    } catch (err) {
      console.error(
        `Failed to ${actionType} donor:`,
        err
      );

      setError(
        err.message ||
          `Could not ${actionType} application.`
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Donor details and appointment scheduling.
  if (liveSelectedDonor) {
    return (
      <DonorDetail
        donor={liveSelectedDonor}
        onBack={() => setSelectedDonor(null)}
        onUpdateStatus={handleStatusUpdate}
        onScheduleAppointment={handleScheduleAppointment}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">
          Donor Applications
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Review applications and approve eligible applicants.
          Approval does not activate a donor. Appointment,
          screening, collection, and activation are separate
          steps.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(event.target.value)
            }
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
            aria-label="Filter by application status"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={selectedBloodType}
            onChange={(event) =>
              setSelectedBloodType(event.target.value)
            }
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
            aria-label="Filter by blood type"
          >
            <option value="">All Blood Types</option>
            {BLOOD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3">
            <Filter
              size={16}
              className="shrink-0 text-gray-400"
            />

            <select
              value={filterCategory}
              onChange={(event) =>
                setFilterCategory(event.target.value)
              }
              className="w-full bg-transparent py-2.5 text-sm outline-none"
              aria-label="Search category"
            >
              <option value="name">Donor Name</option>
              <option value="birthday">Birthday</option>
            </select>
          </div>

          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder={
                filterCategory === "name"
                  ? "Search by name..."
                  : "Search birthday..."
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Search
                size={21}
                className="text-gray-400"
              />
            </div>

            <p className="font-semibold text-gray-700">
              No donor applications found.
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Try changing your filters or search.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Donor</th>
                  <th className="p-4">Blood Type</th>
                  <th className="p-4">Birthday</th>
                  <th className="p-4">
                    Application Status
                  </th>
                  <th className="p-4">
                    Last Donation
                  </th>
                  <th className="p-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                {filtered.map((donor) => {
                  const status = statusOf(donor);

                  return (
                    <tr
                      key={donor.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="p-4">
                        <p className="font-semibold text-gray-900">
                          {donorName(donor)}
                        </p>

                        <span className="mt-1 block text-xs font-normal text-gray-400">
                          {donor.email ||
                            donor.userEmail ||
                            "No email provided"}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 font-bold text-red-700">
                          {donor.bloodType || "N/A"}
                        </span>
                      </td>

                      <td className="p-4">
                        {formatDate(
                          donor.birthday ||
                          donor.birthDate
                        )}
                      </td>

                      <td className="p-4">
                        <StatusBadge status={status} />
                      </td>

                      <td className="p-4">
                        {formatDate(
                          donor.lastDonationDate ||
                            donor.selfReportedLastDonationDate
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title="View application"
                            aria-label={`View ${donorName(donor)}`}
                            onClick={() =>
                              setSelectedDonor(donor)
                            }
                            className="rounded-lg p-2 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye size={17} />
                          </button>

                          <button
                            type="button"
                            title={canArchiveDonor(donor) ? "Archive application" : REJECT_FIRST}
                            disabled={!canArchiveDonor(donor)}
                            aria-label={`Archive ${donorName(donor)}`}
                            onClick={() =>
                              setConfirmAction({
                                type: "archive",
                                donor,
                              })
                            }
                            className="rounded-lg p-2 hover:bg-amber-50 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-current"
                          >
                            <Archive size={17} />
                          </button>

                          <button
                            type="button"
                            title={canArchiveDonor(donor) ? "Delete permanently" : REJECT_FIRST}
                            disabled={!canArchiveDonor(donor)}
                            aria-label={`Delete ${donorName(donor)}`}
                            onClick={() =>
                              setConfirmAction({
                                type: "delete",
                                donor,
                              })
                            }
                            className="rounded-lg p-2 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-current"
                          >
                            <Trash2 size={17} />
                          </button>
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

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-bold capitalize text-gray-900">
              Confirm {confirmAction.type}
            </h2>

            <p className="text-sm text-gray-600">
              Are you sure you want to{" "}
              {confirmAction.type} the application
              for{" "}
              <strong>
                {donorName(confirmAction.donor)}
              </strong>
              ?
            </p>

            {confirmAction.type === "delete" ? (
              <p className="text-sm font-semibold text-red-600">
                This permanently deletes the application and its history and
                cannot be undone. The user can apply again from the app.
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                The donor keeps seeing the rejection in the app. You can restore
                it from Archived Donors.
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setConfirmAction(null)
                }
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={runConfirmAction}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  confirmAction.type === "delete"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {busy
                  ? "Please wait..."
                  : `Yes, ${confirmAction.type}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
