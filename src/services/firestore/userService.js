
// src/services/firestore/userService.js

import { db } from "../../firebase/config";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

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
 * Old identity approval workflow is discontinued.
 *
 * Keep this export temporarily to prevent import errors.
 * Remove callers after migrating the admin UI.
 */
export const updateUserVerificationStatus = async () => {
  throw new Error(
    "Account identity approval is discontinued. " +
    "Review donor applications and blood requests separately."
  );
};
