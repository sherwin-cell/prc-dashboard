// src/services/firestore/verificationService.js
import { db } from "../../firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { logAdminAction } from "../auditService";

/**
 * Maps database status strings to standard UI status tags safely
 */
const mapStatusToUI = (status) => {
  if (!status) return "PENDING";
  const s = String(status).toLowerCase().trim();
  if (s === "under_review" || s === "under-review" || s === "pending" || s === "submitted") return "PENDING";
  if (s === "approved" || s === "verified") return "APPROVED";
  if (s === "rejected" || s === "declined") return "REJECTED";
  return s.toUpperCase();
};

/**
 * Fetch verification submissions from both 'verificationRequests' 
 * and 'users' collections with built-in debugging logs.
 */
export const getVerificationRequests = async (statusFilter = "PENDING") => {
  try {
    const normalizedFilter = (statusFilter || "ALL").toUpperCase();
    let records = [];

    // 1. Primary Query: Read from 'verificationRequests'
    try {
      const requestsRef = collection(db, "verificationRequests");
      const reqSnapshot = await getDocs(requestsRef);

      reqSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        records.push({
          ...data, // Spread raw data first
          id: docSnap.id,
          userId: data.userId || docSnap.id,
          userName: data.fullName || data.userName || data.name || "Unknown User",
          userEmail: data.email || data.userEmail || "No Email",
          status: mapStatusToUI(data.status || data.verificationStatus), // Mapped status goes last
          rawStatus: data.status || data.verificationStatus || "unknown",
          idType: data.idType || "Philippine Gov ID",
          submittedAt: data.submittedAt || data.updatedAt || null,
          idImageUrl: data.idImageUrl || data.idPhotoUrl,
          selfieImageUrl: data.selfieImageUrl || data.selfieUrl,
        });
      });
    } catch (err) {
      console.warn("Could not query verificationRequests collection:", err.message);
    }

    // 2. Secondary Query: Read directly from 'users' collection for profile records
    try {
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);

      usersSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (records.some((r) => r.userId === docSnap.id)) return;

        if (data.verificationStatus || data.idImageUrl) {
          records.push({
            id: docSnap.id,
            userId: docSnap.id,
            userName: data.fullName || data.name || "Unknown User",
            userEmail: data.email || "No Email",
            status: mapStatusToUI(data.verificationStatus || data.status),
            rawStatus: data.verificationStatus || data.status || "unknown",
            idType: data.idType || "Philippine Gov ID",
            submittedAt: data.updatedAt || null,
            idImageUrl: data.idImageUrl || data.idPhotoUrl,
            selfieImageUrl: data.selfieImageUrl || data.selfieUrl,
            extractedName: data.extractedName || data.fullName,
            idNumber: data.idNumber,
            ...data,
          });
        }
      });
    } catch (err) {
      console.warn("Could not query users collection:", err.message);
    }

    // DEBUG LOG: See everything pulled from Firestore before filtering
    console.log("=== TOTAL FETCHED VERIFICATION RECORDS ===", records);

    // Apply active tab filtering properly (handling both PENDING and UNDER_REVIEW nicely)
    if (normalizedFilter !== "ALL") {
      records = records.filter((item) => {
        if (normalizedFilter === "PENDING") {
          return item.status === "PENDING";
        }
        return item.status === normalizedFilter;
      });
    }

    // DEBUG LOG: See records matching the current UI tab filter
    console.log(`=== FILTERED RECORDS FOR [${normalizedFilter}] ===`, records);

    return records;
  } catch (error) {
    console.error("Error fetching verification requests:", error);
    throw error;
  }
};

/**
 * Get single verification submission detail.
 */
export const getVerificationById = async (userId) => {
  try {
    let data = null;

    // Check verificationRequests collection first
    const reqRef = doc(db, "verificationRequests", userId);
    const reqSnap = await getDoc(reqRef);

    if (reqSnap.exists()) {
      data = reqSnap.data();
    } else {
      // Fallback to checking users collection
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        data = userSnap.data();
      }
    }

    if (!data) return null;

    return {
      id: userId,
      userId: userId,
      userName: data.fullName || data.name || "Unknown User",
      userEmail: data.email || "No Email",
      status: mapStatusToUI(data.verificationStatus || data.status),
      govIdUrl: data.idImageUrl || data.idPhotoUrl || null,
      backIdUrl: data.backIdImageUrl || data.backIdPhotoUrl || null,
      selfieUrl: data.selfieImageUrl || data.selfieUrl || null,
      idType: data.idType || "Philippine Gov ID",
      ocrName: data.extractedName || data.fullName || null,
      ocrIdNumber: data.idNumber || null,
      ocrDob: data.ocrDob || data.dob || null,
      ocrAddress: data.ocrAddress || data.address || null,
      faceMatchConfidence: data.faceMatchConfidence ?? null,
      isLive: Boolean(data.hasDetectedFace),
      adminNotes: data.adminNotes || "",
      ...data,
    };
  } catch (error) {
    console.error(`Error fetching verification detail ${userId}:`, error);
    throw error;
  }
};

/**
 * Process identity verification decision (Approve / Reject).
 */
export const processVerificationDecision = async ({
  userId,
  status, // "APPROVED" or "REJECTED"
  adminNotes,
  adminUser,
}) => {
  try {
    const isApproved = status === "APPROVED";
    const newStatus = isApproved ? "approved" : "rejected";

    // 1. Update user record
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      verificationStatus: newStatus,
      isVerified: isApproved,
      adminNotes: adminNotes || "",
      reviewedBy: adminUser?.email || "Admin",
      reviewedAt: serverTimestamp(),
    });

    // 2. Update verificationRequests record if it exists
    try {
      const reqRef = doc(db, "verificationRequests", userId);
      const reqSnap = await getDoc(reqRef);
      if (reqSnap.exists()) {
        await updateDoc(reqRef, {
          status: newStatus,
          adminNotes: adminNotes || "",
          reviewedBy: adminUser?.email || "Admin",
          reviewedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn("No separate verificationRequests doc to update:", e.message);
    }

    // 3. Log administrative audit action
    if (typeof logAdminAction === "function") {
      await logAdminAction(
        adminUser,
        `VERIFICATION_${status}`,
        userId,
        `User identity ${userId} was marked as ${newStatus}. Notes: "${adminNotes || "N/A"}"`
      );
    }

    return true;
  } catch (error) {
    console.error("Failed to process verification decision:", error);
    throw error;
  }
};