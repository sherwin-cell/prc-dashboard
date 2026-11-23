
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  updateDoc,
  deleteField,
  runTransaction,
} from "firebase/firestore";

import { db } from "../../firebase/config";
import { logAdminAction } from "../auditService";
import {
  canArchiveDonor,
  isDonorLegacyArchived,
} from "../../constants/statuses";

// =====================================================
// HELPERS
// =====================================================

function getTime(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  return 0;
}

function normalizeDonor(snapshotDoc) {
  const data = snapshotDoc.data();

  return {
    ...data,
    id: snapshotDoc.id,
    applicationStatus: String(
      data.applicationStatus ||
      data.donorStatus ||
      data.status ||
      "pending"
    ).toLowerCase(),
  };
}

function applicationStatusOf(donor) {
  return String(
    donor.applicationStatus ||
    donor.donorStatus ||
    donor.status ||
    "pending"
  ).toLowerCase();
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

function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const parsed = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function addCalendarMonths(dateString, months) {
  if (!isValidDate(dateString)) {
    throw new Error("Invalid donation date.");
  }

  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const targetIndex = year * 12 + month - 1 + months;
  const targetYear = Math.floor(targetIndex / 12);
  const targetMonth = targetIndex % 12;

  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();

  const targetDate = new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      Math.min(day, lastDay)
    )
  );

  return targetDate.toISOString().slice(0, 10);
}

// Whole-blood donation interval. Confirm this policy with PRC.
export const DONATION_INTERVAL_MONTHS = 3;

/**
 * Donor fields to write after a donation on `donationDate` (YYYY-MM-DD).
 *
 * The donor goes on interval and stops being available, the same as after
 * walk-in activation. The mobile app (DonorEligibility), the backend
 * (is_donor_eligible) and firestore.rules (isEligibleDonor) read
 * isAvailableForDonation and nextEligibleDonationDate. PRC marks the donor
 * available again from Active Donors once the interval has passed.
 */
export function postDonationAvailability(donor, donationDate = todayPhilippines()) {
  const donationIntervalMonths =
    Number(donor?.donationIntervalMonths) > 0
      ? Number(donor.donationIntervalMonths)
      : DONATION_INTERVAL_MONTHS;

  return {
    lastDonationDate: donationDate,
    nextEligibleDonationDate: addCalendarMonths(donationDate, donationIntervalMonths),
    donationIntervalMonths,
    donationAvailabilityStatus: "on_interval",
    isAvailableForDonation: false,
  };
}

export { todayPhilippines };

function requireAdmin(adminUser) {
  if (!adminUser?.uid) {
    throw new Error(
      "Administrator authentication is required."
    );
  }
}

// =====================================================
// USER AND ID VERIFICATION
// =====================================================

async function enrichWithUserVerification(donor) {
  const userId = donor.userId || donor.id;

  if (!userId) {
    return {
      ...donor,
      idVerification: null,
      accountIdVerificationStatus: "unavailable",
    };
  }

  try {
    const [userSnap, idSnap] = await Promise.all([
      getDoc(doc(db, "users", userId)),
      getDoc(doc(db, "id_verifications", userId)),
    ]);

    const user = userSnap.exists() ? userSnap.data() : {};
    const idData = idSnap.exists() ? idSnap.data() : null;

    const hasValidSubmission =
      idData !== null &&
      typeof idData.frontIdImageUrl === "string" &&
      idData.frontIdImageUrl.trim().length > 0 &&
      typeof idData.backIdImageUrl === "string" &&
      idData.backIdImageUrl.trim().length > 0;

    return {
      ...donor,

      userName:
        user.fullName ||
        donor.userName ||
        donor.fullName ||
        "Unknown User",

      userEmail:
        user.email ||
        donor.userEmail ||
        null,

      // ID submission does not mean PRC approval.
      idVerification: hasValidSubmission
        ? idData
        : null,

      accountIdVerificationStatus: !idData
        ? "not_submitted"
        : hasValidSubmission
          ? "submitted"
          : "incomplete",

      // Only the backend or a PRC review sets faceVerified; faceMatchPassed
      // was reported by old app builds and is not trusted.
      faceVerified: user.faceVerified === true,
    };
  } catch (error) {
    console.error(
      `Could not load donor verification for ${userId}:`,
      error
    );

    return {
      ...donor,
      idVerification: null,
      accountIdVerificationStatus: "unavailable",
    };
  }
}

// =====================================================
// FIRESTORE SUBSCRIPTIONS
// =====================================================

export function subscribeToPendingDonors(
  callback,
  onError
) {
  return onSnapshot(
    collection(db, "donors"),
    async (snapshot) => {
      try {
        const donors = await Promise.all(
          snapshot.docs.map((item) =>
            enrichWithUserVerification(
              normalizeDonor(item)
            )
          )
        );

        donors.sort(
          (a, b) =>
            getTime(b.appliedForDonorAt) -
            getTime(a.appliedForDonorAt)
        );

        callback(donors);
      } catch (error) {
        console.error(
          "Could not load donor applications:",
          error
        );
        onError?.(error);
      }
    },
    (error) => {
      console.error("Donor subscription failed:", error);
      onError?.(error);
    }
  );
}

export function subscribeToDonorAppointments(
  callback,
  onError
) {
  const q = query(
    collection(db, "donors"),
    where("applicationStatus", "==", "approved")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const appointments = snapshot.docs
        .map(normalizeDonor)
        .filter((donor) => {
          const status = String(
            donor.appointmentStatus ||
            donor.appointment?.status ||
            ""
          ).toLowerCase();

          return [
            "scheduled",
            "completed",
            "cancelled",
            "no_show",
          ].includes(status);
        })
        .sort((a, b) => {
          const dateA =
            `${a.appointment?.date || ""} ` +
            `${a.appointment?.time || ""}`;

          const dateB =
            `${b.appointment?.date || ""} ` +
            `${b.appointment?.time || ""}`;

          return dateA.localeCompare(dateB);
        });

      callback(appointments);
    },
    (error) => {
      console.error(
        "Appointment subscription failed:",
        error
      );
      onError?.(error);
    }
  );
}

export function subscribeToScreeningDonors(
  callback,
  onError
) {
  const q = query(
    collection(db, "donors"),
    where("applicationStatus", "==", "approved")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const donors = snapshot.docs
        .map(normalizeDonor)
        .filter(
          (donor) =>
            donor.appointmentStatus === "scheduled" ||
            donor.appointmentStatus === "completed" ||
            donor.screeningStatus ||
            donor.collectionStatus
        )
        .sort(
          (a, b) =>
            getTime(b.appointmentScheduledAt) -
            getTime(a.appointmentScheduledAt)
        );

      callback(donors);
    },
    (error) => {
      console.error(
        "Screening subscription failed:",
        error
      );
      onError?.(error);
    }
  );
}

export function subscribeToActiveDonors(
  callback,
  onError
) {
  const q = query(
    collection(db, "donors"),
    where("donorActivationStatus", "==", "active")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const donors = snapshot.docs
        .map(normalizeDonor)
        .sort(
          (a, b) =>
            getTime(b.activatedAt) -
            getTime(a.activatedAt)
        );

      callback(donors);
    },
    (error) => {
      console.error(
        "Active donor subscription failed:",
        error
      );
      onError?.(error);
    }
  );
}

// =====================================================
// DONOR APPLICATION APPROVAL / REJECTION
// =====================================================

export async function updateDonorStatus(
  donorId,
  newStatus,
  adminUser,
  rejectionReason = "",
  reapplicationAllowed = null
) {
  try {
    if (!donorId) {
      throw new Error("Missing donor document ID.");
    }

    requireAdmin(adminUser);

    if (!["approved", "rejected"].includes(newStatus)) {
      throw new Error(
        "Application status must be approved or rejected."
      );
    }

    if (
      newStatus === "rejected" &&
      !rejectionReason.trim()
    ) {
      throw new Error(
        "A rejection reason is required."
      );
    }

    // PRC decides whether a rejected applicant may apply again.
    if (
      newStatus === "rejected" &&
      typeof reapplicationAllowed !== "boolean"
    ) {
      throw new Error(
        "Specify whether reapplication is allowed (Yes or No)."
      );
    }

    const donorRef = doc(db, "donors", donorId);
    const donorSnap = await getDoc(donorRef);

    if (!donorSnap.exists()) {
      throw new Error("Donor application not found.");
    }

    const donor = donorSnap.data();
    const current = applicationStatusOf(donor);

    if (current === "archived" || donor.archived === true) {
      throw new Error(
        "Archived applications cannot be reviewed. Restore it first."
      );
    }

    if (donor.donorActivationStatus === "active") {
      throw new Error(
        "An active donor application cannot be changed here."
      );
    }

    const reviewEventId = crypto.randomUUID();

    await updateDoc(donorRef, {
      applicationStatus: newStatus,
      donorStatus: newStatus,
      reviewEventId,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUser.uid,
      rejectionReason:
        newStatus === "rejected"
          ? rejectionReason.trim()
          : "",
      reapplicationAllowed:
        newStatus === "rejected"
          ? reapplicationAllowed
          : false,
      updatedAt: serverTimestamp(),
    });

    await logAdminAction(
      adminUser,
      `UPDATE_DONOR_APPLICATION_${newStatus.toUpperCase()}`,
      donorId,
      newStatus === "rejected"
        ? `Donor application rejected. Reason: ${rejectionReason.trim()}. Reapplication allowed: ${reapplicationAllowed ? "Yes" : "No"}`
        : "Donor application approved. Further workflow steps remain separate."
    );

    return {
      success: true,
      donorId,
      applicationStatus: newStatus,
      reapplicationAllowed:
        newStatus === "rejected" ? reapplicationAllowed : false,
      reviewEventId,
    };
  } catch (error) {
    console.error(
      "Could not update donor application:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Could not update application.",
    };
  }
}

// =====================================================
// SCHEDULE DONOR APPOINTMENT
// =====================================================

export async function scheduleDonorAppointment(
  donorId,
  appointment,
  adminUser
) {
  try {
    if (!donorId) {
      throw new Error(
        "Missing donor application ID."
      );
    }

    requireAdmin(adminUser);

    if (!appointment?.date || !appointment?.time) {
      throw new Error(
        "Date and time are required."
      );
    }

    if (!appointment?.location?.trim()) {
      throw new Error(
        "Appointment location is required."
      );
    }

    const donorRef = doc(db, "donors", donorId);
    const donorSnap = await getDoc(donorRef);

    if (!donorSnap.exists()) {
      throw new Error(
        "Donor application not found."
      );
    }

    const donor = donorSnap.data();

    if (applicationStatusOf(donor) !== "approved") {
      throw new Error(
        "Approve the application before scheduling an appointment."
      );
    }

    if (donor.donorActivationStatus === "active") {
      throw new Error(
        "This donor is already active."
      );
    }

    const appointmentData = {
      date: appointment.date,
      time: appointment.time,
      location: appointment.location.trim(),
      notes: appointment.notes?.trim() || "",
      status: "scheduled",
    };

    await updateDoc(donorRef, {
      appointment: appointmentData,
      appointmentStatus: "scheduled",
      appointmentScheduledAt: serverTimestamp(),
      appointmentScheduledBy: adminUser.uid,
      updatedAt: serverTimestamp(),
    });

    await logAdminAction(
      adminUser,
      "SCHEDULE_DONOR_APPOINTMENT",
      donorId,
      `Appointment scheduled for ${appointment.date} at ${appointment.time}; location: ${appointment.location.trim()}`
    );

    return {
      success: true,
      donorId,
      appointmentStatus: "scheduled",
      appointment: appointmentData,
    };
  } catch (error) {
    console.error(
      "Could not schedule appointment:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Could not schedule appointment.",
    };
  }
}

// =====================================================
// UPDATE APPOINTMENT STATUS
// =====================================================

export async function updateDonorAppointmentStatus(
  donorId,
  status,
  adminUser
) {
  try {
    requireAdmin(adminUser);

    if (
      ![
        "scheduled",
        "completed",
        "cancelled",
        "no_show",
      ].includes(status)
    ) {
      throw new Error(
        "Invalid appointment status."
      );
    }

    const donorRef = doc(db, "donors", donorId);
    const donorSnap = await getDoc(donorRef);

    if (!donorSnap.exists()) {
      throw new Error(
        "Donor application not found."
      );
    }

    const donor = donorSnap.data();

    if (applicationStatusOf(donor) !== "approved") {
      throw new Error(
        "Only approved applicants can have appointments managed."
      );
    }

    const currentStatus = String(
      donor.appointmentStatus ||
      donor.appointment?.status ||
      "scheduled"
    ).toLowerCase();

    if (
      status === "completed" &&
      currentStatus !== "scheduled"
    ) {
      throw new Error(
        "Only a scheduled appointment can be marked completed."
      );
    }

    if (
      ["cancelled", "no_show"].includes(currentStatus) &&
      status !== "scheduled"
    ) {
      throw new Error(
        "This appointment is closed. Schedule a new appointment instead."
      );
    }

    if (
      currentStatus === "completed" &&
      status !== "completed"
    ) {
      throw new Error(
        "A completed appointment cannot be cancelled or marked as a no-show."
      );
    }

    await updateDoc(donorRef, {
      appointment: {
        ...(donor.appointment || {}),
        status,
      },
      appointmentStatus: status,
      appointmentUpdatedAt: serverTimestamp(),
      appointmentUpdatedBy: adminUser.uid,
      updatedAt: serverTimestamp(),
    });

    await logAdminAction(
      adminUser,
      "UPDATE_DONOR_APPOINTMENT",
      donorId,
      `Appointment status changed to ${status}.`
    );

    return {
      success: true,
      appointmentStatus: status,
    };
  } catch (error) {
    console.error(
      "Could not update appointment:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Could not update appointment.",
    };
  }
}

// =====================================================
// MEDICAL SCREENING
// =====================================================

export async function saveDonorScreening(
  donorId,
  screening,
  adminUser
) {
  try {
    if (!donorId) {
      throw new Error(
        "Donor ID is required."
      );
    }

    requireAdmin(adminUser);

    if (
      ![
        "eligible",
        "deferred",
        "ineligible",
      ].includes(screening?.result)
    ) {
      throw new Error(
        "Select an eligibility result."
      );
    }

    const notes = String(
      screening.notes || ""
    ).trim();

    if (
      ["deferred", "ineligible"].includes(
        screening.result
      ) &&
      !notes
    ) {
      throw new Error(
        "Screening notes are required for deferred or ineligible donors."
      );
    }

    const donorRef = doc(db, "donors", donorId);
    const donorSnap = await getDoc(donorRef);

    if (!donorSnap.exists()) {
      throw new Error(
        "Donor application not found."
      );
    }

    const donor = donorSnap.data();

    if (applicationStatusOf(donor) !== "approved") {
      throw new Error(
        "Only approved applicants can be screened."
      );
    }

    if (donor.appointmentStatus !== "completed") {
      throw new Error(
        "The donor must complete their appointment before screening."
      );
    }

    if (
      donor.collectionStatus === "completed" ||
      donor.collection?.status === "completed" ||
      donor.donorActivationStatus === "active"
    ) {
      throw new Error(
        "Screening cannot be changed after collection or activation."
      );
    }

    const screeningData = {
      result: screening.result,
      notes,
      screenedAt: new Date().toISOString(),
      screenedBy: adminUser.uid,
    };

    const screeningStatus =
      screening.result === "eligible"
        ? "completed"
        : screening.result;

    await updateDoc(donorRef, {
      screening: screeningData,
      screeningStatus,
      updatedAt: serverTimestamp(),
    });

    await logAdminAction(
      adminUser,
      "RECORD_DONOR_SCREENING",
      donorId,
      `Screening result recorded: ${screening.result}.`
    );

    return {
      success: true,
      screeningStatus,
    };
  } catch (error) {
    console.error(
      "Could not save screening:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Could not save screening.",
    };
  }
}

// =====================================================
// BLOOD COLLECTION
// =====================================================

export async function saveDonorCollection(
  donorId,
  collectionData,
  adminUser
) {
  try {
    if (!donorId) {
      throw new Error(
        "Donor ID is required."
      );
    }

    requireAdmin(adminUser);

    const collectionDate = collectionData?.date;

    if (!isValidDate(collectionDate)) {
      throw new Error(
        "A valid collection date is required."
      );
    }

    if (collectionDate > todayPhilippines()) {
      throw new Error(
        "Collection date cannot be in the future."
      );
    }

    const units = Number(collectionData?.units);

    if (
      collectionData?.units === "" ||
      collectionData?.units == null ||
      !Number.isInteger(units) ||
      units < 1 ||
      units > 3
    ) {
      throw new Error(
        "Collection quantity must be a whole number between 1 and 3."
      );
    }

    const donorRef = doc(db, "donors", donorId);
    const donorSnap = await getDoc(donorRef);

    if (!donorSnap.exists()) {
      throw new Error(
        "Donor application not found."
      );
    }

    const donor = donorSnap.data();

    if (applicationStatusOf(donor) !== "approved") {
      throw new Error(
        "Only approved applicants can proceed to collection."
      );
    }

    if (
      donor.collectionStatus === "completed" ||
      donor.collection?.status === "completed"
    ) {
      throw new Error(
        "Blood collection has already been recorded."
      );
    }

    if (donor.donorActivationStatus === "active") {
      throw new Error(
        "Future donations must be recorded in donation history."
      );
    }

    if (donor.appointmentStatus !== "completed") {
      throw new Error(
        "Complete the donor appointment first."
      );
    }

    if (
      donor.screeningStatus !== "completed" ||
      donor.screening?.result !== "eligible"
    ) {
      throw new Error(
        "An eligible medical screening is required."
      );
    }

    const collectionRecord = {
      date: collectionDate,
      units,
      notes: collectionData.notes?.trim() || "",
      status: "completed",
      recordedAt: new Date().toISOString(),
      recordedBy: adminUser.uid,
    };

    await updateDoc(donorRef, {
      collection: collectionRecord,
      collectionStatus: "completed",
      updatedAt: serverTimestamp(),
    });

    await logAdminAction(
      adminUser,
      "RECORD_DONOR_COLLECTION",
      donorId,
      `Blood collection recorded on ${collectionDate}.`
    );

    return {
      success: true,
      donorId,
      collectionStatus: "completed",
    };
  } catch (error) {
    console.error(
      "Could not save donor collection:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Could not save collection.",
    };
  }
}

// =====================================================
// DONOR ACTIVATION
// =====================================================

export async function activateDonor(
  donorId,
  adminUser
) {
  try {
    if (!donorId) {
      throw new Error(
        "Donor ID is required."
      );
    }

    requireAdmin(adminUser);

    const donorRef = doc(db, "donors", donorId);
    const donorSnap = await getDoc(donorRef);

    if (!donorSnap.exists()) {
      throw new Error(
        "Donor application not found."
      );
    }

    const donor = donorSnap.data();

    if (donor.donorActivationStatus === "active") {
      throw new Error(
        "This donor is already activated."
      );
    }

    if (applicationStatusOf(donor) !== "approved") {
      throw new Error(
        "Only approved donor applicants can be activated."
      );
    }

    if (donor.appointmentStatus !== "completed") {
      throw new Error(
        "The donor appointment must be completed."
      );
    }

    if (
      donor.screeningStatus !== "completed" ||
      donor.screening?.result !== "eligible"
    ) {
      throw new Error(
        "An eligible medical screening is required."
      );
    }

    if (
      donor.collectionStatus !== "completed" ||
      donor.collection?.status !== "completed"
    ) {
      throw new Error(
        "A completed collection record is required."
      );
    }

    const lastDonationDate = donor.collection?.date;

    if (!isValidDate(lastDonationDate)) {
      throw new Error(
        "A valid completed collection date is required."
      );
    }

    const today = todayPhilippines();

    if (lastDonationDate > today) {
      throw new Error(
        "The collection date cannot be in the future."
      );
    }

    const donationIntervalMonths = DONATION_INTERVAL_MONTHS;

    const nextEligibleDonationDate = addCalendarMonths(
      lastDonationDate,
      donationIntervalMonths
    );

    // Interval completion is not medical clearance.
    const donationAvailabilityStatus =
      today < nextEligibleDonationDate
        ? "on_interval"
        : "medical_hold";

    const availabilityData = {
      lastDonationDate,
      nextEligibleDonationDate,
      donationAvailabilityStatus,
      donationIntervalMonths,
      // Read by the mobile app, backend matching and firestore.rules.
      isAvailableForDonation: false,
    };

    const batch = writeBatch(db);

    batch.update(donorRef, {
      donorActivationStatus: "active",
      isDonor: true,
      ...availabilityData,
      activatedAt: serverTimestamp(),
      activatedBy: adminUser.uid,
      updatedAt: serverTimestamp(),
    });

    // Update explicitly linked user profile.
    const userId = donor.userId;

    if (userId) {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        batch.update(userRef, {
          isDonor: true,
          donorActivationStatus: "active",
          ...availabilityData,
          donorActivatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();

    await logAdminAction(
      adminUser,
      "ACTIVATE_DONOR",
      donorId,
      `Donor activated. Last donation: ${lastDonationDate}. ` +
      `Next interval date: ${nextEligibleDonationDate}. ` +
      `Availability: ${donationAvailabilityStatus}.`
    );

    return {
      success: true,
      donorId,
      donorActivationStatus: "active",
      lastDonationDate,
      nextEligibleDonationDate,
      donationAvailabilityStatus,
    };
  } catch (error) {
    console.error(
      "Could not activate donor:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Could not activate donor.",
    };
  }
}

// =====================================================
// PRC DONOR AVAILABILITY MANAGEMENT
// =====================================================


export async function updateDonorAvailability(
  donorId,
  availabilityData,
  adminUser
) {
  try {
    // ==========================================
    // 1. BASIC VALIDATION
    // ==========================================

    if (!donorId) {
      throw new Error("Donor ID is required.");
    }

    requireAdmin(adminUser);

    const status = availabilityData?.status;

    const allowedActions = [
      "available",
      "medical_hold",
      "lift_hold",
    ];

    if (!allowedActions.includes(status)) {
      throw new Error(
        "Select a valid availability action."
      );
    }

    const notes = String(
      availabilityData?.notes || ""
    ).trim();

    if (!notes) {
      throw new Error(
        status === "available"
          ? "Enter PRC clearance notes or reference."
          : status === "lift_hold"
            ? "Enter a reason for lifting the Medical Hold."
            : "Enter the reason for the Medical Hold."
      );
    }

    if (
      status === "available" &&
      availabilityData?.prcClearanceConfirmed !== true
    ) {
      throw new Error(
        "PRC medical clearance confirmation is required."
      );
    }

    if (
      status === "available" &&
      availabilityData?.donorAvailabilityConfirmed !== true
    ) {
      throw new Error(
        "The donor's current availability must be confirmed."
      );
    }

    const today = todayPhilippines();
    const donorRef = doc(db, "donors", donorId);

    // ==========================================
    // 2. FIRESTORE TRANSACTION
    // ==========================================

    const savedStatus = await runTransaction(
      db,
      async (transaction) => {
        const donorSnap = await transaction.get(
          donorRef
        );

        if (!donorSnap.exists()) {
          throw new Error(
            "Donor record not found."
          );
        }

        const donor = donorSnap.data();

        // Only activated donors can be managed.
        if (
          donor.donorActivationStatus !== "active" ||
          donor.isDonor !== true
        ) {
          throw new Error(
            "Only activated donors can have availability managed."
          );
        }

        const currentStatus =
          donor.donationAvailabilityStatus;

        // ==========================================
        // ACTION 1: LIFT MEDICAL HOLD
        // ==========================================

        if (status === "lift_hold") {
          if (currentStatus !== "medical_hold") {
            throw new Error(
              "Only donors currently on Medical Hold can have their hold lifted."
            );
          }

          // Lifting a hold does not make a donor available.
          // A separate PRC clearance review is required.

          transaction.update(donorRef, {
            donationAvailabilityStatus: "on_interval",
            isAvailableForDonation: false,

            availabilityReview: {
              status: "on_interval",
              action: "lift_hold",
              notes,

              previousHoldReason:
                donor.availabilityReview?.notes || "",

              clearanceConfirmed: false,
              donorAvailabilityConfirmed: false,

              reviewedBy: adminUser.uid,
              reviewedAt: serverTimestamp(),
            },

            updatedAt: serverTimestamp(),
          });

          return "on_interval";
        }

        // ==========================================
        // ACTION 2: PLACE DONOR ON MEDICAL HOLD
        // ==========================================

        if (status === "medical_hold") {
          if (currentStatus === "medical_hold") {
            throw new Error(
              "This donor is already on Medical Hold."
            );
          }

          transaction.update(donorRef, {
            donationAvailabilityStatus: "medical_hold",
            isAvailableForDonation: false,

            availabilityReview: {
              status: "medical_hold",
              action: "medical_hold",
              notes,

              clearanceConfirmed: false,
              donorAvailabilityConfirmed: false,

              reviewedBy: adminUser.uid,
              reviewedAt: serverTimestamp(),
            },

            updatedAt: serverTimestamp(),
          });

          return "medical_hold";
        }

        // ==========================================
        // ACTION 3: MARK DONOR AVAILABLE
        // ==========================================

        if (status === "available") {
          // Medical Hold cannot be bypassed.
          if (currentStatus === "medical_hold") {
            throw new Error(
              "Lift the Medical Hold before marking this donor available."
            );
          }

          if (currentStatus === "available") {
            throw new Error(
              "This donor is already marked available."
            );
          }

          if (currentStatus !== "on_interval") {
            throw new Error(
              "This donor requires an availability review before being marked available."
            );
          }

          const nextDate =
            donor.nextEligibleDonationDate;

          if (!isValidDate(nextDate)) {
            throw new Error(
              "A valid next donation interval date is required."
            );
          }

          if (today < nextDate) {
            throw new Error(
              `The donor is on a donation interval until ${nextDate}.`
            );
          }

          // Verify the original donor workflow.
          if (
            applicationStatusOf(donor) !== "approved" ||
            donor.appointmentStatus !== "completed" ||
            donor.screeningStatus !== "completed" ||
            donor.screening?.result !== "eligible" ||
            donor.collectionStatus !== "completed" ||
            donor.collection?.status !== "completed"
          ) {
            throw new Error(
              "The original donor approval, appointment, screening, or collection records are incomplete."
            );
          }

          // Confirm both PRC medical clearance and
          // donor availability before saving.
          if (
            availabilityData?.prcClearanceConfirmed !== true ||
            availabilityData?.donorAvailabilityConfirmed !== true
          ) {
            throw new Error(
              "Both PRC clearance and donor availability confirmation are required."
            );
          }

          transaction.update(donorRef, {
            donationAvailabilityStatus: "available",
            isAvailableForDonation: true,

            availabilityReview: {
              status: "available",
              action: "mark_available",
              notes,

              clearanceConfirmed: true,
              donorAvailabilityConfirmed: true,

              reviewedBy: adminUser.uid,
              reviewedAt: serverTimestamp(),
            },

            updatedAt: serverTimestamp(),
          });

          return "available";
        }

        throw new Error(
          "Unsupported donor availability action."
        );
      }
    );

    // ==========================================
    // 3. ADMIN AUDIT LOG
    // ==========================================

    // Audit failure is reported separately because
    // the transaction has already committed.

    let auditWarning = null;

    try {
      const auditAction =
        status === "lift_hold"
          ? "LIFT_DONOR_MEDICAL_HOLD"
          : status === "medical_hold"
            ? "PLACE_DONOR_MEDICAL_HOLD"
            : "MARK_DONOR_AVAILABLE";

      await logAdminAction(
        adminUser,
        auditAction,
        donorId,
        `Donor availability changed to ${savedStatus}. Notes: ${notes}`
      );
    } catch (auditError) {
      console.error(
        "Availability saved, but audit logging failed:",
        auditError
      );

      auditWarning =
        "Availability saved, but the audit entry could not be recorded.";
    }

    // ==========================================
    // 4. SUCCESS RESPONSE
    // ==========================================

    return {
      success: true,
      donorId,
      donationAvailabilityStatus: savedStatus,

      ...(auditWarning
        ? { warning: auditWarning }
        : {}),
    };
  } catch (error) {
    // ==========================================
    // 5. ERROR RESPONSE
    // ==========================================

    console.error(
      "Could not update donor availability:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Could not update donor availability.",
    };
  }
}

// =====================================================
// ARCHIVE / RESTORE / DELETE APPLICATIONS
// =====================================================

// Donor fields activation and donations copy onto users/{uid}.
const USER_DONOR_FIELDS = [
  "donorActivationStatus",
  "donorActivatedAt",
  "lastDonationDate",
  "nextEligibleDonationDate",
  "donationAvailabilityStatus",
  "donationIntervalMonths",
  "isAvailableForDonation",
];

/**
 * Hide a rejected application from PRC's lists. Admin-only flag: the status
 * stays "rejected", so the donor keeps seeing PRC's decision and reason in the
 * app and can still reapply if PRC allowed it.
 */
export async function archiveDonorApplication(donorId, adminUser) {
  try {
    requireAdmin(adminUser);
    const donorRef = doc(db, "donors", donorId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(donorRef);
      if (!snap.exists()) throw new Error("Donor application not found.");
      const donor = snap.data();
      if (!canArchiveDonor(donor)) {
        throw new Error(
          "Only rejected applications can be archived. Review pending applications first; " +
            "manage approved donors through availability."
        );
      }
      tx.update(donorRef, {
        archived: true,
        archivedAt: serverTimestamp(),
        archivedBy: adminUser.uid,
        updatedAt: serverTimestamp(),
      });
    });

    await logAdminAction(adminUser, "ARCHIVE_DONOR_APPLICATION", donorId, "Rejected application archived");
    return { success: true };
  } catch (error) {
    console.error("Could not archive donor application:", error);
    return { success: false, error: error.message || "Could not archive the application." };
  }
}

/**
 * Bring an archived application back. Current archives only clear the flag.
 * Legacy archives overwrote applicationStatus / donorStatus / status with
 * "archived"; all three are reset together (approved for an activated donor,
 * otherwise pending for PRC to review again).
 */
export async function restoreDonorApplication(donorId, adminUser) {
  try {
    requireAdmin(adminUser);
    const donorRef = doc(db, "donors", donorId);
    let restoredStatus = null;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(donorRef);
      if (!snap.exists()) throw new Error("Donor application not found.");
      const donor = snap.data();

      const update = {
        archived: false,
        restoredAt: serverTimestamp(),
        restoredBy: adminUser.uid,
        updatedAt: serverTimestamp(),
      };
      if (isDonorLegacyArchived(donor)) {
        restoredStatus = donor.donorActivationStatus === "active" ? "approved" : "pending";
        Object.assign(update, {
          applicationStatus: restoredStatus,
          donorStatus: restoredStatus,
          status: restoredStatus,
        });
      }
      tx.update(donorRef, update);
    });

    await logAdminAction(
      adminUser,
      "RESTORE_DONOR_APPLICATION",
      donorId,
      restoredStatus ? `Legacy archived application restored as ${restoredStatus}` : "Application restored from archive"
    );
    return { success: true, restoredStatus };
  } catch (error) {
    console.error("Could not restore donor application:", error);
    return { success: false, error: error.message || "Could not restore the application." };
  }
}

/**
 * Permanently delete a rejected (or legacy archived) application with its
 * application history, and clear the donor fields copied to users/{uid}.
 * The user can then apply again from the app. Their past offers stay as
 * request records.
 */
export async function deleteDonorApplication(donorId, adminUser) {
  try {
    requireAdmin(adminUser);
    const donorRef = doc(db, "donors", donorId);
    const donorSnap = await getDoc(donorRef);
    if (!donorSnap.exists()) return { success: true };
    const donor = donorSnap.data();

    if (!canArchiveDonor(donor) && !(isDonorLegacyArchived(donor) && donor.donorActivationStatus !== "active")) {
      throw new Error("Only rejected applications can be deleted.");
    }

    const history = await getDocs(collection(db, "donors", donorId, "application_history"));
    const userRef = doc(db, "users", donor.userId || donorId);
    const userSnap = await getDoc(userRef);

    const batch = writeBatch(db);
    history.docs.forEach((item) => batch.delete(item.ref));
    batch.delete(donorRef);
    if (userSnap.exists()) {
      batch.update(userRef, {
        isDonor: false,
        ...Object.fromEntries(USER_DONOR_FIELDS.map((field) => [field, deleteField()])),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();

    await logAdminAction(
      adminUser,
      "DELETE_DONOR_APPLICATION",
      donorId,
      `Donor application deleted with ${history.size} history record(s)`
    );
    return { success: true };
  } catch (error) {
    console.error("Could not delete donor application:", error);
    return { success: false, error: error.message || "Could not delete the application." };
  }
}
