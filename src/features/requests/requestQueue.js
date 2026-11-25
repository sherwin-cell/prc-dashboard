// Tabs, urgency, filters, KPIs and CSV export for the Blood Requests page.
// Status values are the existing ones (constants/statuses.js); "PRC Stock
// Ready" is an open request with a PRC stock notice (prcStock, written by
// blood_connect_backend prc_stock/), not a separate status.

import {
  RequestStatus,
  isRequestArchived,
  isRequestOpen,
  requestStatusLabel,
  unitsNeededOf,
} from "../../constants/statuses";

const norm = (value) => String(value ?? "").trim().toLowerCase();

export const QUEUE_TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved / Matching" },
  { id: "prcStock", label: "PRC Stock Ready" },
  { id: "fulfilled", label: "Fulfilled" },
  // Also holds cancelled and expired requests, which need no PRC action.
  { id: "closed", label: "Rejected / Archived" },
];

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

// Spelled as in the app (blood_connect sorsogon_locations.dart), which writes
// users/{uid}.municipality.
export const SORSOGON_MUNICIPALITIES = [
  "Barcelona", "Bulan", "Bulusan", "Casiguran", "Castilla", "Donsol", "Gubat", "Irosin",
  "Juban", "Magallanes", "Matnog", "Pilar", "Prieto Diaz", "Santa Magdalena", "Sorsogon City",
];

/** The requester's municipality (older profiles used `city`). */
export const municipalityOf = (profile) => String(profile?.municipality || profile?.city || "").trim();

export const prcStockNoticesOf = (request) =>
  Array.isArray(request?.prcStockNotices) ? request.prcStockNotices : [];

export const hasPrcStock = (request) =>
  prcStockNoticesOf(request).length > 0 || Boolean(request?.prcStock);

export const reservedUnitsOf = (request) => Number(request?.prcStock?.reservedUnits) || 0;

/** The single tab a request belongs to (besides "All"). */
export function queueTabOf(request) {
  if (isRequestArchived(request)) return "closed";
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

export const URGENCY = {
  critical: { label: "Critical", dot: "bg-rose-600", classes: "bg-rose-100 text-rose-800 ring-rose-200" },
  urgent: { label: "Urgent", dot: "bg-amber-500", classes: "bg-amber-100 text-amber-800 ring-amber-200" },
  scheduled: { label: "Scheduled", dot: "bg-sky-500", classes: "bg-sky-50 text-sky-800 ring-sky-200" },
  none: { label: "No date", dot: "bg-gray-300", classes: "bg-gray-100 text-gray-600 ring-gray-200" },
};

/** Critical: needed today or overdue. Urgent: within the next two days. Scheduled: later. */
export function urgencyOf(request, now = new Date()) {
  const due = neededByOf(request);
  if (!due) return { level: "none", ...URGENCY.none };
  const days = phDay(due) - phDay(now);
  const level = days <= 0 ? "critical" : days <= 2 ? "urgent" : "scheduled";
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

export const shortId = (id) => `#${String(id || "").slice(0, 6).toUpperCase()}`;

export function matchesSearch(request, text, requesterName = "") {
  const wanted = norm(text).replace(/^#/, "");
  if (!wanted) return true;
  // matchedDonorCodes: anonymised codes of confirmed donors (DNR-0023).
  const donorCodes = Array.isArray(request?.matchedDonorCodes) ? request.matchedDonorCodes : [];
  return [request?.patientName, requesterName, request?.hospitalName, request?.hospital, request?.id, ...donorCodes]
    .some((value) => norm(value).includes(wanted));
}

const ACTIVE_TABS = ["pending", "approved", "prcStock"];

/** Requests PRC still acts on first, most urgent first; the rest newest first. */
export function sortRequests(requests) {
  const created = (r) => toDate(r.createdAt)?.getTime() || 0;
  const due = (r) => neededByOf(r)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const active = (r) => ACTIVE_TABS.includes(queueTabOf(r));
  return [...requests].sort((a, b) => {
    if (active(a) !== active(b)) return active(a) ? -1 : 1;
    if (active(a)) return due(a) - due(b) || created(a) - created(b);
    return created(b) - created(a);
  });
}

const phMonth = (date) => {
  const shifted = new Date(date.getTime() + PH_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${shifted.getUTCMonth()}`;
};

/** The four KPI cards, from the live request list. */
export function requestKpis(requests, now = new Date()) {
  const kpis = { pending: 0, critical: 0, criticalPending: 0, approved: 0, matched: 0, prcStock: 0, fulfilledThisMonth: 0 };
  const month = phMonth(now);
  for (const request of requests) {
    const tab = queueTabOf(request);
    if (tab === "pending") kpis.pending += 1;
    if (tab === "approved" || tab === "prcStock") {
      kpis.approved += 1;
      if (norm(request.status) === RequestStatus.matched) kpis.matched += 1;
      if (tab === "prcStock") kpis.prcStock += 1;
    }
    if (ACTIVE_TABS.includes(tab) && urgencyOf(request, now).level === "critical") {
      kpis.critical += 1;
      if (tab === "pending") kpis.criticalPending += 1;
    }
    if (tab === "fulfilled" || (isRequestArchived(request) && norm(request.status) === RequestStatus.fulfilled)) {
      const at = toDate(request.fulfilledAt ?? request.updatedAt);
      if (at && phMonth(at) === month) kpis.fulfilledThisMonth += 1;
    }
  }
  return kpis;
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

// Spreadsheet apps run cells that start with these as formulas.
const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV of the given rows ({ request, requesterName, municipality }). */
export function requestsCsv(rows) {
  const header = [
    "Request ID", "Patient", "Requester", "Blood type", "Units", "Component", "Hospital",
    "Municipality", "Needed by", "Urgency", "Status", "Archived", "PRC reserved units", "Submitted",
  ];
  const lines = rows.map(({ request, requesterName, municipality }) => {
    const urgency = showsUrgency(request) ? urgencyOf(request).label : "";
    const due = neededByOf(request);
    const created = toDate(request.createdAt);
    return [
      request.id, request.patientName, requesterName, request.bloodType, unitsNeededOf(request),
      request.component || "Whole Blood", request.hospitalName || request.hospital, municipality,
      due ? due.toISOString().slice(0, 10) : "", urgency, requestStatusLabel(request.status),
      isRequestArchived(request) ? "yes" : "", reservedUnitsOf(request) || "",
      created ? created.toISOString() : "",
    ].map(csvCell).join(",");
  });
  return [header.map(csvCell).join(","), ...lines].join("\r\n");
}
