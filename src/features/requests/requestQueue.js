// Queue tabs, urgency and search for the Blood Requests workspace.
// Status values are the existing ones (constants/statuses.js); "PRC Stock
// Ready" is an open request with a PRC stock notice (prcStock, written by
// blood_connect_backend prc_stock/), not a separate status.

import {
  RequestStatus,
  isRequestArchived,
  isRequestOpen,
  unitsNeededOf,
} from "../../constants/statuses";

const norm = (value) => String(value ?? "").trim().toLowerCase();

export const QUEUE_TABS = [
  { id: "pending", label: "Pending Review" },
  { id: "approved", label: "Approved" },
  { id: "prcStock", label: "PRC Stock Ready" },
  { id: "fulfilled", label: "Fulfilled" },
  // Cancelled, rejected and expired: not asked for as a tab, but without one
  // they could not be found (or archived) at all.
  { id: "closed", label: "Closed" },
  { id: "archived", label: "Archived" },
];

export const prcStockNoticesOf = (request) =>
  Array.isArray(request?.prcStockNotices) ? request.prcStockNotices : [];

export const hasPrcStock = (request) =>
  prcStockNoticesOf(request).length > 0 || Boolean(request?.prcStock);

export const reservedUnitsOf = (request) => Number(request?.prcStock?.reservedUnits) || 0;

export function queueTabOf(request) {
  if (isRequestArchived(request)) return "archived";
  const status = norm(request?.status) || RequestStatus.pending;
  if (status === RequestStatus.pending) return "pending";
  if (isRequestOpen(status)) return hasPrcStock(request) ? "prcStock" : "approved";
  if (status === RequestStatus.fulfilled) return "fulfilled";
  return "closed";
}

/** Firestore Timestamp, {seconds}, Date, ISO string or millis -> Date (or null). */
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The app writes neededByDate (and requiredDate as a copy); older records use neededBy. */
export const neededByOf = (request) =>
  toDate(request?.neededByDate ?? request?.neededBy ?? request?.requiredDate);

// Calendar days in the Philippines (UTC+8), where PRC and requesters are.
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const phDay = (date) => Math.floor((date.getTime() + PH_OFFSET_MS) / 86_400_000);

const URGENCY = {
  urgent: { label: "Today / Urgent", classes: "bg-rose-100 text-rose-800 ring-rose-200", rank: 0 },
  soon: { label: "Within 48h", classes: "bg-amber-100 text-amber-800 ring-amber-200", rank: 1 },
  scheduled: { label: "Scheduled", classes: "bg-sky-50 text-sky-800 ring-sky-200", rank: 2 },
  none: { label: "No target date", classes: "bg-gray-100 text-gray-600 ring-gray-200", rank: 3 },
};

/** Due today or overdue / due in the next two days / later. */
export function urgencyOf(request, now = new Date()) {
  const due = neededByOf(request);
  if (!due) return { level: "none", ...URGENCY.none };
  const days = phDay(due) - phDay(now);
  const level = days <= 0 ? "urgent" : days <= 2 ? "soon" : "scheduled";
  return { level, days, ...URGENCY[level] };
}

/** Urgency matters only while PRC still has something to do. */
export const showsUrgency = (request) => ["pending", "approved", "prcStock"].includes(queueTabOf(request));

export const requirementLabel = (request) => {
  const units = unitsNeededOf(request);
  return [
    request?.bloodType || "Blood type ?",
    `${units} unit${units === 1 ? "" : "s"}`,
    request?.component || "Whole Blood",
  ].join(" · ");
};

export function matchesSearch(request, text, requesterName = "") {
  const wanted = norm(text);
  if (!wanted) return true;
  return [request?.patientName, requesterName, request?.hospitalName, request?.hospital, request?.id]
    .some((value) => norm(value).includes(wanted));
}

/** Work queues: most urgent first. Finished ones: newest first. */
export function sortForTab(requests, tab) {
  const created = (request) => toDate(request.createdAt)?.getTime() || 0;
  const list = [...requests];
  if (["pending", "approved", "prcStock"].includes(tab)) {
    const due = (request) => neededByOf(request)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return list.sort((a, b) => due(a) - due(b) || created(a) - created(b));
  }
  return list.sort((a, b) => created(b) - created(a));
}

export const formatDate = (value, withTime = false) => {
  const date = toDate(value);
  if (!date) return "Not specified";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
};

/** users/{uid} display name (same precedence as the backend). */
export const userNameOf = (profile) => {
  if (!profile) return "";
  const full = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  return profile.fullName || full || profile.displayName || profile.name || profile.email || "";
};
