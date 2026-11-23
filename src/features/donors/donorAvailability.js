// Donor names, dates and availability, shared by the Donors page and the
// availability modal. The availability rules are PRC's (formerly inside
// ActiveDonorsPage); the app, backend and firestore.rules read the same
// isAvailableForDonation / nextEligibleDonationDate fields.

import { todayPhilippines } from "../../services/firestore/donorService";

export { todayPhilippines };

export function nameOf(donor) {
  const fullName = [donor?.firstName, donor?.middleName, donor?.lastName].filter(Boolean).join(" ");
  return donor?.fullName || donor?.userName || fullName || donor?.displayName || "Unnamed donor";
}

/** "YYYY-MM-DD", Timestamp, {seconds} or Date -> local PH date text. */
export function dateOf(value) {
  if (!value) return "N/A";
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  }
  let date;
  if (typeof value.toDate === "function") date = value.toDate();
  else if (typeof value.seconds === "number") date = new Date(value.seconds * 1000);
  else date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" });
}

export function validDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * { key: "available" | "on_interval" | "medical_hold", label, description }.
 * medical_hold also covers "Awaiting clearance" and "Review required".
 */
export function getAvailability(donor, today) {
  const status = String(donor.donationAvailabilityStatus || "").toLowerCase();
  const nextDate = donor.nextEligibleDonationDate;

  // Medical hold always takes priority, even within the interval.
  if (status === "medical_hold") {
    return { key: "medical_hold", label: "Medical Hold", description: "PRC has placed this donor on hold" };
  }
  if (!validDateString(nextDate)) {
    return { key: "medical_hold", label: "Review Required", description: "Missing or invalid interval date" };
  }
  if (today < nextDate) {
    return { key: "on_interval", label: "On Donation Interval", description: `Next interval: ${dateOf(nextDate)}` };
  }
  // Interval ended, but PRC has not recorded clearance yet.
  if (status === "on_interval") {
    return {
      key: "medical_hold",
      label: "Awaiting Clearance",
      description: "Donation interval completed. PRC review required.",
    };
  }
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
      return { key: "available", label: "Available", description: "PRC clearance recorded" };
    }
    return { key: "medical_hold", label: "Review Required", description: "PRC clearance record missing or incomplete" };
  }
  return { key: "medical_hold", label: "Review Required", description: "Donor availability has not been confirmed" };
}

/** Which availability actions PRC may take on this donor today. */
export function availabilityActions(donor, today) {
  const intervalComplete = validDateString(donor.nextEligibleDonationDate) && today >= donor.nextEligibleDonationDate;
  const onHold = donor.donationAvailabilityStatus === "medical_hold";
  return {
    intervalComplete,
    canMarkAvailable: intervalComplete && !onHold && getAvailability(donor, today).key !== "available",
    canPlaceHold: !onHold,
    canReviewHold: onHold,
  };
}

export const AVAILABILITY_STYLES = {
  available: "bg-emerald-100 text-emerald-800",
  on_interval: "bg-amber-100 text-amber-800",
  medical_hold: "bg-blue-100 text-blue-800",
};
