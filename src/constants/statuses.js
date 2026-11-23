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
  // Legacy only: older admin builds overwrote status with "archived", which
  // the mobile app and backend do not know. Archiving now sets the admin-only
  // `archived: true` flag and keeps the real status. Never write this value.
  archived: "archived",
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

/**
 * Finished requests PRC may archive or delete. Their request_summaries entry
 * is already closed (fulfilled/cancelled/expired) or never existed (rejected),
 * so donors no longer see them.
 */
const REQUEST_ARCHIVABLE = [
  RequestStatus.fulfilled,
  RequestStatus.cancelled,
  RequestStatus.rejected,
  RequestStatus.expired,
];
export const canArchiveRequest = (status) => REQUEST_ARCHIVABLE.includes(norm(status));

/** Hidden from the active list: the admin-only flag, or the legacy status value. */
export const isRequestArchived = (request) =>
  request?.archived === true || norm(request?.status) === RequestStatus.archived;

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

// users/{uid}.faceVerification.result
// verified / failed: written by blood_connect_backend (automatic face match).
// approved_by_admin / rejected_by_admin: written by PRC here.
// Keep in sync with FaceVerificationResult in statuses.dart.
export const FaceVerificationResult = {
  verified: "verified",
  failed: "failed",
  approvedByAdmin: "approved_by_admin",
  rejectedByAdmin: "rejected_by_admin",
};

/**
 * Where a user stands on identity verification:
 * "verified" | "needs_review" (automatic match failed) | "rejected" | "not_started".
 */
export const faceReviewState = (user) => {
  const result = norm(user?.faceVerification?.result);
  if (user?.faceVerified === true) return "verified";
  if (result === FaceVerificationResult.rejectedByAdmin) return "rejected";
  if (result === FaceVerificationResult.failed) return "needs_review";
  return "not_started";
};

export const faceReviewLabel = (state) =>
  ({
    verified: "Verified",
    needs_review: "Needs review",
    rejected: "Rejected by PRC",
    not_started: "Not verified",
  })[state] || "Not verified";

export const faceReviewClasses = (state) =>
  ({
    verified: "bg-emerald-100 text-emerald-800",
    needs_review: "bg-amber-100 text-amber-800",
    rejected: "bg-rose-100 text-rose-800",
  })[state] || "bg-gray-100 text-gray-700";

// face_verification_attempts/{id}.outcome (blood_connect_backend Code values)
export const faceAttemptLabel = (outcome) =>
  ({
    verified: "Matched",
    not_matched: "Did not match",
    already_verified: "Already verified",
    id_required: "No ID on file",
    invalid_id_image_url: "ID image not on PRC Cloudinary",
    invalid_selfie: "Invalid selfie",
    selfie_too_large: "Selfie too large",
    not_configured: "Server not configured",
    attempt_limit: "Daily limit reached",
    id_image_unavailable: "ID image unavailable",
    no_face_in_selfie: "No face in selfie",
    no_face_in_id: "No face on ID",
    matcher_unavailable: "Matcher unavailable",
    upload_failed: "Selfie upload failed",
  })[norm(outcome)] || outcome || "Unknown";
