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
import { logAdminAction } from '../auditService'; // Adjust relative path based on where auditService.js is located

/**
 * Subscribe to real-time pending blood requests
 */
export function subscribeToPendingRequests(callback, onError) {
  const q = query(
    collection(db, 'blood_requests'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(requests);
  }, onError);
}

/**
 * Approve or Reject a blood request status
 */
export async function updateRequestStatus(requestId, newStatus, adminUser) {
  try {
    const requestRef = doc(db, 'blood_requests', requestId);
    
    await updateDoc(requestRef, {
      status: newStatus, // 'active' or 'rejected'
      reviewedAt: new Date(),
      reviewedBy: adminUser?.uid || 'admin',
    });

    // Log the admin action using your audit service
    await logAdminAction(
      adminUser, 
      `UPDATE_REQUEST_STATUS_${newStatus.toUpperCase()}`, 
      requestId, 
      `Blood request status changed to ${newStatus}`
    );

    return { success: true };
  } catch (error) {
    console.error("Error updating request status:", error);
    return { success: false, error: error.message };
  }
}