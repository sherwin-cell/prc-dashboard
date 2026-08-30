import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { logAdminAction } from '../auditService';

/**
 * Subscribe to real-time pending donor applications
 */
export function subscribeToPendingDonors(callback, onError) {
  const q = query(
    collection(db, 'donors'),
    where('donorStatus', '==', 'pending'),
    orderBy('appliedForDonorAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const donors = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(donors);
  }, onError);
}

/**
 * Approve or Reject a donor application
 */
export async function updateDonorStatus(userId, newStatus, adminUser) {
  try {
    // FIXED: Point to the 'donors' collection instead of 'users'
    const donorRef = doc(db, 'donors', userId);
    
    const isApproved = newStatus === 'approved';

    await updateDoc(donorRef, {
      donorStatus: newStatus, // 'approved' or 'rejected'
      isDonor: isApproved,    // Set to true if approved so they show in public feed
      reviewedAt: new Date(),
      reviewedBy: adminUser?.uid || 'admin',
    });

    await logAdminAction(
      adminUser,
      `UPDATE_DONOR_STATUS_${newStatus.toUpperCase()}`,
      userId,
      `Donor application status changed to ${newStatus}`
    );

    return { success: true };
  } catch (error) {
    console.error("Error updating donor status:", error);
    return { success: false, error: error.message };
  }
}