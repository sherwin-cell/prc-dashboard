// Activity timeline for one request, built from the timestamps the app,
// the portal and the backend already write on blood_requests/{id}.

import { RequestStatus } from "../../constants/statuses";
import { prcStockNoticesOf, toDate } from "./requestQueue";

const norm = (value) => String(value ?? "").trim().toLowerCase();

/** [{ key, at: Date, tone, title, detail, actorId }] oldest first. */
export function requestTimeline(request) {
  const events = [];
  const add = (key, value, tone, title, detail = "", actorId = null) => {
    const at = toDate(value);
    if (at) events.push({ key, at, tone, title, detail, actorId });
  };
  const notices = prcStockNoticesOf(request);

  add("submitted", request.createdAt, "gray", "Request submitted", "", request.requesterId || request.userId);

  if (request.reviewedAt) {
    const rejected = norm(request.status) === RequestStatus.rejected || Boolean(request.rejectionReason);
    const withStock = notices.some((n) => n.approvedRequest);
    add(
      "reviewed",
      request.reviewedAt,
      rejected ? "rose" : "emerald",
      rejected ? "Rejected by PRC" : withStock ? "Approved with PRC stock" : "Approved by PRC",
      rejected ? request.rejectionReason || request.adminNotes || "" : "",
      request.reviewedBy
    );
  }

  notices.forEach((notice, index) => {
    const units = Number(notice.reservedUnits) || 0;
    add(
      `prc-${index}`,
      notice.notifiedAt,
      "violet",
      `PRC stock notice${notices.length > 1 ? ` #${index + 1}` : ""}: ${units} unit${units === 1 ? "" : "s"} reserved`,
      notice.pickupInstructions || "",
      notice.notifiedBy
    );
  });

  add("matched", request.matchedAt, "emerald", "All units matched with confirmed donors");
  add("reopened", request.reopenedAt, "amber", "Reopened to donors");
  add("fulfilled", request.fulfilledAt, "blue", "Marked fulfilled", "", request.fulfilledBy);
  add("cancelled", request.cancelledAt, "gray", "Cancelled by the requester", request.cancellationReason || "", request.cancelledBy);
  add("expired", request.expiredAt, "gray", "Expired (target date passed)");
  add("archived", request.archivedAt, "gray", "Archived", "", request.archivedBy);
  add("restored", request.restoredAt, "gray", "Restored from the archive", "", request.restoredBy);

  return events.sort((a, b) => a.at - b.at);
}
