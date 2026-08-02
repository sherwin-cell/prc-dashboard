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
  serverTimestamp 
} from "firebase/firestore";
import { updateUserVerificationStatus } from "./userService";
import { logAdminAction } from "../auditService";

/**
 * Fetch users filtered by verification status from the 'users' collection
 */
export const getVerificationRequests = async (statusFilter = "PENDING") => {
  try {
    const usersRef = collection(db, "users");
    
    // Normalize status filter (e.g., "PENDING" -> "pending")
    const targetStatus = statusFilter.toLowerCase();
    
    let q;
    if (statusFilter && statusFilter !== "ALL") {
      q = query(usersRef, where("verificationStatus", "==", targetStatus));
    } else {
      q = usersRef;
    }

    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: doc.id,
        // Map user document fields to match your UI component expectations
        userName: data.fullName || data.name || "Unknown User",
        userEmail: data.email || "No Email",
        status: (data.verificationStatus || "pending").toUpperCase(),
        idType: data.idType || "Government ID",
        submittedAt: data.updatedAt || data.createdAt,
        ...data,
      };
    });
  } catch (error) {
    console.error("Error fetching verification requests from users collection:", error);
    throw error;
  }
};

/**
 * Get single user verification detail
 */
export const getVerificationById = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return { 
        id: docSnap.id, 
        userId: docSnap.id,
        userName: data.fullName || data.name,
        userEmail: data.email,
        status: (data.verificationStatus || "pending").toUpperCase(),
        ...data 
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching user verification detail ${userId}:`, error);
    throw error;
  }
};

/**
 * Process identity verification decision (Verify / Reject)
 */
export const processVerificationDecision = async ({
  userId,
  status, // "APPROVED" or "REJECTED"
  adminNotes,
  adminUser,
}) => {
  try {
    const userRef = doc(db, "users", userId);
    const isApproved = status === "APPROVED" || status === "VERIFIED";

    // Update status on the user document in Firestore
    await updateDoc(userRef, {
      verificationStatus: isApproved ? "approved" : "rejected",
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