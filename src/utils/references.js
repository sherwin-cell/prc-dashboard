// Human-readable references, matching the mobile app's historyReference()
// (blood_connect/lib/features/history/domain/history_entries.dart):
// "<prefix>-<YYYYMMDD>-<first 3 alphanumerics of the doc id>".

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function historyReference(prefix, docId, createdAt) {
  const date = toDate(createdAt) ?? new Date(0);
  // The app formats the date in the phone's time zone; PRC is in the Philippines.
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" })
    .format(date)
    .replaceAll("-", "");
  const suffix = String(docId || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const short = suffix.length >= 3 ? suffix.slice(0, 3) : suffix.padEnd(3, "0");
  return `${prefix}-${ymd}-${short}`;
}

/** "BR-20261120-ABC", the reference requesters see for a blood request. */
export const bloodRequestReference = (requestId, createdAt) =>
  historyReference("BR", requestId, createdAt);
