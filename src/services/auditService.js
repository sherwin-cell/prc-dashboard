// src/services/auditService.js
import { db } from "../firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Log all administrative actions to the audit_logs collection.
 */
export const logAdminAction = async (adminUser, action, affectedUser = "N/A", details = "") => {
  try {
    await addDoc(collection(db, "audit_logs"), {
      adminName: adminUser?.displayName || adminUser?.email || "Admin",
      adminEmail: adminUser?.email || "unknown@redcross.ph",
      action,
      affectedUser,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to log audit entry:", error);
  }
};