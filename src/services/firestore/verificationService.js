// src/services/firestore/verificationService.js
import { db } from "../../firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { logAdminAction } from "../auditService";

/**
 * Fetch verification submissions filtered by status from the
 * 'verifications' collection (this is where the mobile app actually
 * writes idPhotoUrl, selfieUrl, extractedName, idNumber, etc.)
 */
export const getVerificationRequests = async (statusFilter = "PENDING") => {
  try {
    const verificationsRef = collection(db, "verifications");

    // Statuses are stored lowercase in Firestore (e.g. "pending")
    const targetStatus = statusFilter.toLowerCase();

    let q;
    if (statusFilter && statusFilter !== "ALL") {
      q = query(verificationsRef, where("status", "==", targetStatus));
    } else {
      q = verificationsRef;
    }

    const snapshot = await getDocs(q);

    // Verification docs don't store the user's name/email directly, so
    // pull those from the linked users/{userId} doc for display.
    const results = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let userName = "Unknown User";
        let userEmail = "No Email";

        try {
          const userSnap = await getDoc(doc(db, "users", data.userId || docSnap.id));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            userName = userData.fullName || userData.name || userName;
            userEmail = userData.email || userEmail;
          }
        } catch (e) {
          console.warn(`Could not fetch user info for ${docSnap.id}:`, e);
        }

        return {
          id: docSnap.id,
          userId: data.userId || docSnap.id,
          userName,
          userEmail,
          status: (data.status || "pending").toUpperCase(),
          idType: data.idType || "Philippine Gov ID",
          submittedAt: data.submittedAt,
          ...data,
        };
      })
    );

    return results;
  } catch (error) {
    console.error("Error fetching verification requests:", error);
    throw error;
  }
};

/**
 * Get a single verification submission's detail, merged with basic
 * user info for display.
 */
export const getVerificationById = async (userId) => {
  try {
    const verificationRef = doc(db, "verifications", userId);
    const docSnap = await getDoc(verificationRef);
    if (!docSnap.exists()) return null;

    const data = docSnap.data();

    let userName = "Unknown User";
    let userEmail = "No Email";
    try {
      const userSnap = await getDoc(doc(db, "users", data.userId || userId));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        userName = userData.fullName || userData.name || userName;
        userEmail = userData.email || userEmail;
      }
    } catch (e) {
      console.warn(`Could not fetch user info for ${userId}:`, e);
    }

    return {
      id: docSnap.id,
      userId: data.userId || userId,
      userName,
      userEmail,
      status: (data.status || "pending").toUpperCase(),
      // Map real field names written by the Flutter app to what the
      // detail page expects to render.
      govIdUrl: data.idPhotoUrl,
      backIdUrl: data.backIdPhotoUrl,
      selfieUrl: data.selfieUrl,
      idType: data.idType || "Philippine Gov ID",
      ocrName: data.extractedName,
      ocrIdNumber: data.idNumber,
      // Not currently produced by the OCR pipeline — left undefined so
      // the UI correctly shows "N/A" instead of a fake value.
      ocrDob: data.ocrDob,
      ocrAddress: data.ocrAddress,
      // The face detector only returns a boolean today, not a % score.
      faceMatchConfidence: data.faceMatchConfidence, // undefined for now
      isLive: data.hasDetectedFace,
      adminNotes: data.adminNotes,
      ...data,
    };
  } catch (error) {
    console.error(`Error fetching verification detail ${userId}:`, error);
    throw error;
  }
};

/**
 * Process identity verification decision (Approve / Reject).
 * Updates both the 'verifications' doc (so the admin list/detail views
 * reflect the decision) and the 'users' doc (so the mobile app sees it).
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

    // 1. Update the verification submission record
    const verificationRef = doc(db, "verifications", userId);
    await updateDoc(verificationRef, {
      status: newStatus,
      adminNotes: adminNotes || "",
      reviewedBy: adminUser?.email || "Admin",
      reviewedAt: serverTimestamp(),
    });

    // 2. Update the user's main profile status (read by the mobile app)
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      verificationStatus: newStatus,
      isVerified: isApproved,
      adminNotes: adminNotes || "",
      reviewedBy: adminUser?.email || "Admin",
      reviewedAt: serverTimestamp(),
    });

    // Log administrative audit entry
    await logAdminAction(
      adminUser,
      `VERIFICATION_${status}`,
      userId,
      `User identity ${userId} was marked as ${status.toLowerCase()}. Notes: "${adminNotes || "N/A"}"`
    );

    return true;
  } catch (error) {
    console.error("Failed to process verification decision:", error);
    throw error;
  }
};