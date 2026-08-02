// src/services/firestore/userService.js
import { db } from "../../firebase/config";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

/**
 * Fetch user profile by UID
 */
export const getUserById = async (userId) => {
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    throw error;
  }
};

/**
 * Update verification status on the main user profile
 */
export const updateUserVerificationStatus = async (userId, isVerified, status, notes) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      isVerified,
      verificationStatus: status,
      verificationNotes: notes || "",
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(`Error updating user ${userId} verification status:`, error);
    throw error;
  }
};