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

const mapStatusToUI = (status) => {
    if (!status) return "PENDING";
    const s = String(status).toLowerCase().trim();
    if (s === "pending" || s === "under_review" || s === "submitted") return "PENDING";
    if (s === "approved" || s === "verified") return "APPROVED";
    if (s === "rejected" || s === "declined") return "REJECTED";
    return s.toUpperCase();
};

/**
 * Fetch verification requests directly from the 'users' collection 
 * where a verification has been submitted.
 */
export const getVerificationRequests = async (statusFilter = "PENDING") => {
    try {
        const normalizedFilter = (statusFilter || "ALL").toUpperCase();
        let records = [];

        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);

        usersSnapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            
            // Only include users who have submitted verification data or have a status
            if (data.idImageUrl || data.verificationStatus) {
                const currentStatus = mapStatusToUI(data.verificationStatus || "pending");
                
                records.push({
                    id: docSnap.id,
                    userId: docSnap.id,
                    userName: data.fullName || data.name || "Unknown User",
                    userEmail: data.email || "No Email",
                    status: currentStatus,
                    rawStatus: data.verificationStatus || "pending",
                    idType: data.idType || "Philippine Gov ID",
                    submittedAt: data.updatedAt || data.submittedAt || null,
                    idImageUrl: data.idImageUrl || data.idPhotoUrl,
                    selfieImageUrl: data.selfieImageUrl || data.selfieUrl,
                    ...data,
                });
            }
        });

        // Filter by UI tab tab (PENDING, APPROVED, REJECTED, ALL)
        if (normalizedFilter !== "ALL") {
            records = records.filter((item) => item.status === normalizedFilter);
        }

        return records;
    } catch (error) {
        console.error("Error fetching verification requests from users collection:", error);
        throw error;
    }
};

/**
 * Get single verification submission detail from the user document.
 */
export const getVerificationById = async (userId) => {
    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return null;

        const data = userSnap.data();

        return {
            id: userId,
            userId: userId,
            userName: data.fullName || data.name || "Unknown User",
            userEmail: data.email || "No Email",
            status: mapStatusToUI(data.verificationStatus),
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
 * Process identity verification decision directly on the user record.
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

        // Update the user record directly. 
        // Both the mobile app and admin dashboard look at this collection.
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            verificationStatus: newStatus,
            isVerified: isApproved,
            adminNotes: adminNotes || "",
            reviewedBy: adminUser?.email || "Admin",
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // Log audit action
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