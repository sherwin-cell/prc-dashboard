// Status values stored in Firestore.
//
// Keep these in sync with the mobile app (blood_connect/lib/core/constants/
// statuses.dart) and firestore.rules. They are persisted data: never rename a
// value without migrating the documents that already use it.

const norm = (status) => String(status ?? "").trim().toLowerCase();

// blood_requests/{id}.status
// pending → approved/active → matched → fulfilled,
// with cancelled / rejected / expired as terminal states.
export const RequestStatus = {
  pending: "pending",
  approved: "approved",
  active: "active", // legacy alias of approved
  matched: "matched",
  fulfilled: "fulfilled",
  cancelled: "cancelled", // withdrawn by the requester
  rejected: "rejected",
  expired: "expired",
  archived: "archived", // admin-only, hidden from the active list
};

const REQUEST_OPEN = [RequestStatus.approved, RequestStatus.active, RequestStatus.matched];
const REQUEST_CLOSED = [
  RequestStatus.fulfilled,
  RequestStatus.cancelled,
  RequestStatus.rejected,
  RequestStatus.expired,
  RequestStatus.archived,
];

/** Approved by PRC and still waiting for blood: offers can be handled and it can be fulfilled. */
export const isRequestOpen = (status) => REQUEST_OPEN.includes(norm(status));

/** No further PRC action makes sense on this request. */
export const isRequestClosed = (status) => REQUEST_CLOSED.includes(norm(status));

export const requestStatusLabel = (status) => {
  switch (norm(status)) {
    case "":
    case RequestStatus.pending:
      return "Pending review";
    case RequestStatus.approved:
    case RequestStatus.active:
      return "Open to donors";
    case RequestStatus.matched:
      return "Donor matched";
    case RequestStatus.fulfilled:
      return "Fulfilled";
    case RequestStatus.cancelled:
      return "Cancelled by requester";
    case RequestStatus.rejected:
      return "Rejected";
    case RequestStatus.expired:
      return "Expired";
    case RequestStatus.archived:
      return "Archived";
    default:
      return status;
  }
};

export const requestStatusClasses = (status) => {
  switch (norm(status)) {
    case RequestStatus.approved:
    case RequestStatus.active:
    case RequestStatus.matched:
      return "bg-emerald-100 text-emerald-800";
    case RequestStatus.fulfilled:
      return "bg-blue-100 text-blue-800";
    case RequestStatus.rejected:
      return "bg-rose-100 text-rose-800";
    case RequestStatus.cancelled:
    case RequestStatus.expired:
    case RequestStatus.archived:
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-amber-100 text-amber-800";
  }
};

// blood_requests/{id}/offers/{offerId}.status
// pending → approved (PRC confirmed) → donated,
// with rejected (PRC declined) / withdrawn (donor) as terminal states.
export const OfferStatus = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  withdrawn: "withdrawn",
  donated: "donated",
  legacyAccepted: "accepted", // older requester-side "Accept"; counts as approved
};

/** PRC confirmed the match but the donation is not recorded yet. */
export const isOfferConfirmed = (status) =>
  [OfferStatus.approved, OfferStatus.legacyAccepted].includes(norm(status));

export const isOfferPending = (status) => norm(status || OfferStatus.pending) === OfferStatus.pending;

export const offerStatusLabel = (status) => {
  switch (norm(status)) {
    case "":
    case OfferStatus.pending:
      return "Waiting for PRC";
    case OfferStatus.approved:
    case OfferStatus.legacyAccepted:
      return "Confirmed by PRC";
    case OfferStatus.rejected:
      return "Declined";
    case OfferStatus.withdrawn:
      return "Withdrawn by donor";
    case OfferStatus.donated:
      return "Donated";
    default:
      return status;
  }
};

export const offerStatusClasses = (status) => {
  switch (norm(status)) {
    case OfferStatus.approved:
    case OfferStatus.legacyAccepted:
      return "bg-emerald-100 text-emerald-800";
    case OfferStatus.donated:
      return "bg-blue-100 text-blue-800";
    case OfferStatus.rejected:
      return "bg-rose-100 text-rose-800";
    case OfferStatus.withdrawn:
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-amber-100 text-amber-800";
  }
};
