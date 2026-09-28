import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { logAdminAction } from '../auditService';

/**
 * Subscribe to real-time pending donor applications and pull account-level ID verification details.
 */
export function subscribeToPendingDonors(callback, onError) {
  const q = query(
    collection(db, 'donors'),
    where('donorStatus', '==', 'pending'),
    orderBy('appliedForDonorAt', 'desc')
  );

  return onSnapshot(q, async (snapshot) => {
    try {
      const donorPromises = snapshot.docs.map(async (docSnap) => {
        const donorData = { id: docSnap.id, ...docSnap.data() };
        
        // Fetch the corresponding user profile to pull reusable ID verification details
        if (donorData.userId) {
          const userDocRef = doc(db, 'users', donorData.userId);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            donorData.idVerification = userData.idVerificationData || userData.idVerification;
          }
        }
        
        return donorData;
      });

      const donors = await Promise.all(donorPromises);
      callback(donors);
    } catch (err) {
      onError(err);
    }
  }, onError);
}

/**
 * Approve or Reject a donor application and atomically update the user's account verification status.
 */
export async function updateDonorStatus(userId, newStatus, adminUser) {
  try {
    const batch = writeBatch(db);
    const isApproved = newStatus === 'approved';

    // 1. Update the account-level user document
    const userRef = doc(db, 'users', userId);
    batch.update(userRef, {
      idVerificationStatus: newStatus, // 'approved' or 'rejected'
      updatedAt: serverTimestamp(),
    });

    // 2. Update the donor application document
    const donorRef = doc(db, 'donors', userId);
    batch.update(donorRef, {
      donorStatus: newStatus,
      isDonor: isApproved,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUser?.uid || 'admin',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    await logAdminAction(
      adminUser,
      `UPDATE_DONOR_STATUS_${newStatus.toUpperCase()}`,
      userId,
      `Donor status and account verification changed to ${newStatus}`
    );

    return { success: true };
  } catch (error) {
    console.error("Error updating donor status:", error);
    return { success: false, error: error.message };
  }
}