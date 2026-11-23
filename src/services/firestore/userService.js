
// src/services/firestore/userService.js

import { db } from "../../firebase/config";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { logAdminAction } from "../auditService";
import { apiRequest } from "../apiClient";
import { FaceVerificationResult } from "../../constants/statuses";

/**
 * Face verification attempts logged by blood_connect_backend
 * (POST /api/verification/face), newest first.
 *
 * Admin-read-only collection; sorted here instead of with orderBy so no
 * composite index is needed.
 */
export const getFaceVerificationAttempts = async (userId, max = 50) => {
  try {
    const snapshot = await getDocs(
      query(collection(db, "face_verification_attempts"), where("userId", "==", userId))
    );
    const millis = (value) =>
      typeof value?.toMillis === "function" ? value.toMillis() : 0;

    return snapshot.docs
      .map((attemptDoc) => ({ ...attemptDoc.data(), id: attemptDoc.id }))
      .sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
      .slice(0, max);
  } catch (error) {
    console.error(`Error fetching face attempts for ${userId}:`, error);
    throw error;
  }
};

/**
 * PRC manually approves or rejects a user's identity verification, e.g.
 * after the automatic face match failed or the daily limit was reached.
 *
 * Keeps the backend's score/provider in faceVerification and records who
 * decided. A transaction so a concurrent backend pass is not clobbered.
 */
export const reviewFaceVerification = async (userId, approve, adminUser, note = "") => {
  const userRef = doc(db, "users", userId);
  const result = approve
    ? FaceVerificationResult.approvedByAdmin
    : FaceVerificationResult.rejectedByAdmin;
  const trimmedNote = String(note || "").trim();

  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(userRef);
    if (!snapshot.exists()) throw new Error("User no longer exists.");

    const current = snapshot.data();
    if (!approve && current.faceVerified === true &&
        current.faceVerification?.result === FaceVerificationResult.verified) {
      throw new Error(
        "This user passed the automatic face match. Rejecting it is not supported here."
      );
    }

    tx.update(userRef, {
      faceVerified: approve,
      "faceVerification.result": result,
      "faceVerification.method": "admin_review",
      "faceVerification.reviewedBy": adminUser?.uid || "admin",
      "faceVerification.reviewedByName":
        adminUser?.displayName || adminUser?.email || "PRC Admin",
      "faceVerification.reviewedAt": serverTimestamp(),
      "faceVerification.reviewNote": trimmedNote || null,
      updatedAt: serverTimestamp(),
    });
  });

  await logAdminAction(
    adminUser,
    approve ? "FACE_VERIFICATION_APPROVED" : "FACE_VERIFICATION_REJECTED",
    userId,
    trimmedNote || (approve ? "Identity approved by PRC" : "Identity rejected by PRC")
  );
  return { success: true, result };
};

/**
 * Get all registered users.
 * Intended for authenticated PRC administrators.
 */
export const getUsers = async () => {
  try {
    const snapshot = await getDocs(collection(db, "users"));

    return snapshot.docs.map((userDoc) => ({
      ...userDoc.data(),
      id: userDoc.id,
      uid: userDoc.id,
    }));
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
};

/**
 * Get one user by Firebase UID.
 */
export const getUserById = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      ...snapshot.data(),
      id: snapshot.id,
      uid: snapshot.id,
    };
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    throw error;
  }
};

/**
 * Get the user's one-time ID submission.
 *
 * ID submissions are stored at:
 * id_verifications/{userId}
 *
 * Submission does NOT mean identity approval.
 */
export const getUserIdSubmission = async (userId) => {
  try {
    const idRef = doc(db, "id_verifications", userId);
    const snapshot = await getDoc(idRef);

    if (!snapshot.exists()) {
      return {
        submitted: false,
        status: "not_submitted",
        data: null,
      };
    }

    const data = snapshot.data();

    const hasBothImages =
      typeof data.frontIdImageUrl === "string" &&
      data.frontIdImageUrl.trim().length > 0 &&
      typeof data.backIdImageUrl === "string" &&
      data.backIdImageUrl.trim().length > 0;

    return {
      submitted: hasBothImages,
      status: hasBothImages ? "submitted" : "incomplete",
      data: {
        ...data,
        id: snapshot.id,
      },
    };
  } catch (error) {
    console.error(
      `Error fetching ID submission for ${userId}:`,
      error
    );
    throw error;
  }
};

/**
 * Get blood requests created by a user.
 *
 * Supports records using either requesterId
 * or the legacy userId field.
 */
export const getUserBloodRequests = async (userId) => {
  try {
    const requestsRef = collection(db, "blood_requests");

    const [currentSnapshot, legacySnapshot] = await Promise.all([
      getDocs(query(requestsRef, where("requesterId", "==", userId))),
      getDocs(query(requestsRef, where("userId", "==", userId))),
    ]);

    const results = new Map();

    for (const snapshot of [currentSnapshot, legacySnapshot]) {
      for (const requestDoc of snapshot.docs) {
        results.set(requestDoc.id, {
          ...requestDoc.data(),
          id: requestDoc.id,
        });
      }
    }

    return Array.from(results.values());
  } catch (error) {
    console.error(
      `Error fetching blood requests for ${userId}:`,
      error
    );
    throw error;
  }
};

/**
 * Delete a user's account through blood_connect_backend
 * (DELETE /api/admin/users/{uid}), the same cleanup as the app's Delete
 * Account: in-progress requests are cancelled, active offers withdrawn,
 * uploaded images, personal documents and chats deleted, and the Firebase
 * Auth user removed. Closed requests and offers stay as PRC records.
 */
export const deleteUserAccount = async (userId, adminUser) => {
  const result = await apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  // The backend records account_deletions/{uid}; this keeps PRC's own audit trail.
  try {
    await logAdminAction(adminUser, "DELETE_USER_ACCOUNT", userId,
      `Account deleted: ${JSON.stringify(result.summary || {})}`);
  } catch (error) {
    console.error("Account deleted, but the audit entry failed:", error);
  }
  return result;
};
