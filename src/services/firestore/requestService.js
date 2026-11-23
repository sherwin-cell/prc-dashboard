import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { logAdminAction } from '../auditService'; // Adjust relative path based on where auditService.js is located
import {
  OfferStatus,
  RequestStatus,
  canArchiveRequest,
  countsTowardMatch,
  isOfferConfirmed,
  isOfferPending,
  isRequestOpen,
  offerStatusLabel,
  requestStatusLabel,
  unitsNeededOf,
} from '../../constants/statuses';
import { postDonationAvailability, todayPhilippines } from './donorService';

/**
 * Subscribe to one blood request so the detail page reflects changes made
 * elsewhere (e.g. the requester cancelling from the mobile app).
 */
export function subscribeToRequest(requestId, callback, onError) {
  return onSnapshot(
    doc(db, 'blood_requests', requestId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

/**
 * Subscribe to the donor offers on a request.
 */
export function subscribeToRequestOffers(requestId, callback, onError) {
  return onSnapshot(
    collection(db, 'blood_requests', requestId, 'offers'),
    (snapshot) =>
      callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))),
    onError
  );
}

/**
 * PRC marks an approved request as fulfilled (blood was received).
 *
 * In the same transaction: closes the donor-facing summary and declines every
 * offer still waiting for PRC (rejectionReason "request_fulfilled"). The
 * backend tells those donors "Offer not selected"; confirmed offers are left
 * so PRC can still record their donations.
 */
export async function markRequestFulfilled(requestId, adminUser) {
  try {
    const requestRef = doc(db, 'blood_requests', requestId);
    const summaryRef = doc(db, 'request_summaries', requestId);
    // Transactions cannot run queries: find pending offers first, then
    // re-read each one inside the transaction.
    const pendingRefs = (await getDocs(collection(db, 'blood_requests', requestId, 'offers'))).docs
      .filter((offer) => isOfferPending(offer.data().status))
      .map((offer) => offer.ref);
    let declined = 0;

    await runTransaction(db, async (tx) => {
      const requestSnap = await tx.get(requestRef);
      const summarySnap = await tx.get(summaryRef);
      const pendingSnaps = [];
      for (const ref of pendingRefs) pendingSnaps.push(await tx.get(ref));

      if (!requestSnap.exists()) throw new Error('Blood request no longer exists.');
      const status = requestSnap.data().status;
      if (!isRequestOpen(status)) {
        throw new Error(
          `This request is "${requestStatusLabel(status)}" and can no longer be marked fulfilled.`
        );
      }

      tx.update(requestRef, {
        status: RequestStatus.fulfilled,
        fulfilledAt: serverTimestamp(),
        fulfilledBy: adminUser?.uid || 'admin',
        updatedAt: serverTimestamp(),
      });

      if (summarySnap.exists()) {
        tx.update(summaryRef, { status: RequestStatus.fulfilled, updatedAt: serverTimestamp() });
      }

      declined = 0;
      for (const snap of pendingSnaps) {
        // Skip offers withdrawn or handled since they were listed.
        if (!snap.exists() || !isOfferPending(snap.data().status)) continue;
        tx.update(snap.ref, {
          status: OfferStatus.rejected,
          rejectedAt: serverTimestamp(),
          rejectedBy: adminUser?.uid || 'admin',
          rejectionReason: 'request_fulfilled',
          updatedAt: serverTimestamp(),
        });
        declined += 1;
      }
    });

    await logAdminAction(
      adminUser,
      'UPDATE_REQUEST_STATUS_FULFILLED',
      requestId,
      `Blood request marked fulfilled; ${declined} pending offer(s) declined`
    );

    return { success: true, declined };
  } catch (error) {
    console.error('Error marking request fulfilled:', error);
    return { success: false, error: error.message };
  }
}

/**
 * PRC handles a donor offer:
 *   pending            → approved (Confirm Match) | rejected (Decline)
 *   approved/accepted  → donated
 *
 * Re-reads the offer and request inside a transaction so PRC cannot act on
 * an offer the donor has withdrawn or a request the requester has cancelled.
 */
export async function updateOfferStatus(requestId, offerId, newStatus, adminUser) {
  try {
    const requestRef = doc(db, 'blood_requests', requestId);
    const offerRef = doc(db, 'blood_requests', requestId, 'offers', offerId);

    await runTransaction(db, async (tx) => {
      const requestSnap = await tx.get(requestRef);
      const offerSnap = await tx.get(offerRef);

      if (!requestSnap.exists()) throw new Error('Blood request no longer exists.');
      if (!offerSnap.exists()) throw new Error('This offer no longer exists.');

      const requestStatus = requestSnap.data().status;
      const offerStatus = offerSnap.data().status;

      // Recording a donation also puts the donor on interval (see below), so
      // read their records now: a transaction must read before it writes.
      let donorRef = null;
      let donorSnap = null;
      let userRef = null;
      let userSnap = null;
      const donorId = offerSnap.data().donorId;
      if (newStatus === OfferStatus.donated && donorId) {
        donorRef = doc(db, 'donors', donorId);
        donorSnap = await tx.get(donorRef);
        const userId = (donorSnap.exists() && donorSnap.data().userId) || donorId;
        userRef = doc(db, 'users', userId);
        userSnap = await tx.get(userRef);
      }

      const allowed =
        newStatus === OfferStatus.rejected
          ? isOfferPending(offerStatus)
          : newStatus === OfferStatus.approved
            ? isOfferPending(offerStatus) && isRequestOpen(requestStatus)
            : newStatus === OfferStatus.donated
              ? isOfferConfirmed(offerStatus) &&
                (isRequestOpen(requestStatus) || requestStatus === RequestStatus.fulfilled)
              : false;

      if (!allowed) {
        throw new Error(
          `Cannot change this offer to "${offerStatusLabel(newStatus)}": the offer is ` +
            `"${offerStatusLabel(offerStatus)}" and the request is "${requestStatusLabel(requestStatus)}".`
        );
      }

      const uid = adminUser?.uid || 'admin';
      const update = { status: newStatus, updatedAt: serverTimestamp() };
      if (newStatus === OfferStatus.approved) Object.assign(update, { approvedAt: serverTimestamp(), approvedBy: uid });
      if (newStatus === OfferStatus.rejected) Object.assign(update, { rejectedAt: serverTimestamp(), rejectedBy: uid });
      if (newStatus === OfferStatus.donated) Object.assign(update, { donatedAt: serverTimestamp(), donatedBy: uid });

      tx.update(offerRef, update);

      // Same fields as walk-in activation: the mobile app, backend matching
      // and firestore.rules then stop the donor offering until PRC marks
      // them available again after the interval.
      if (donorSnap?.exists()) {
        const availability = postDonationAvailability(donorSnap.data(), todayPhilippines());
        tx.update(donorRef, {
          ...availability,
          lastDonationRequestId: requestId,
          updatedAt: serverTimestamp(),
        });
        if (userSnap?.exists()) {
          tx.update(userRef, { ...availability, updatedAt: serverTimestamp() });
        }
      }
    });

    await logAdminAction(
      adminUser,
      `UPDATE_OFFER_STATUS_${newStatus.toUpperCase()}`,
      requestId,
      `Offer ${offerId} changed to ${newStatus}`
    );

    // A newly confirmed donor may complete the request.
    let match = null;
    if (newStatus === OfferStatus.approved) {
      match = await reconcileMatchedStatus(requestId, adminUser);
    }

    return { success: true, match };
  } catch (error) {
    console.error('Error updating offer status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Hide a finished request from the active list.
 *
 * Archiving is an admin-only flag: the status stays fulfilled / cancelled /
 * rejected / expired, which the mobile app and backend understand, and the
 * request_summaries entry is already closed for those statuses, so donors are
 * unaffected. Open or pending requests must be closed first.
 */
export async function archiveRequest(requestId, adminUser) {
  try {
    const requestRef = doc(db, 'blood_requests', requestId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(requestRef);
      if (!snap.exists()) throw new Error('Blood request no longer exists.');
      const status = snap.data().status;
      if (!canArchiveRequest(status)) {
        throw new Error(
          `Only finished requests can be archived; this one is "${requestStatusLabel(status || RequestStatus.pending)}". ` +
            'Reject it, mark it fulfilled, or wait for it to expire first.'
        );
      }
      tx.update(requestRef, {
        archived: true,
        archivedAt: serverTimestamp(),
        archivedBy: adminUser?.uid || 'admin',
        updatedAt: serverTimestamp(),
      });
    });

    await logAdminAction(adminUser, 'ARCHIVE_REQUEST', requestId, 'Blood request archived');
    return { success: true };
  } catch (error) {
    console.error('Error archiving request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Bring an archived request back to the active list.
 *
 * Current archives only clear the flag. Legacy archives overwrote the status
 * with "archived"; they get back the status their donor-facing summary still
 * shows (the summary was never updated when they were archived), or
 * "pending" if PRC never approved them.
 */
export async function restoreRequest(requestId, adminUser) {
  try {
    const requestRef = doc(db, 'blood_requests', requestId);
    const summaryRef = doc(db, 'request_summaries', requestId);
    let restoredStatus = null;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(requestRef);
      const summarySnap = await tx.get(summaryRef);
      if (!snap.exists()) throw new Error('Blood request no longer exists.');

      const update = {
        archived: false,
        restoredAt: serverTimestamp(),
        restoredBy: adminUser?.uid || 'admin',
        updatedAt: serverTimestamp(),
      };

      const status = String(snap.data().status || '').trim().toLowerCase();
      if (status === RequestStatus.archived) {
        const summaryStatus = summarySnap.exists()
          ? String(summarySnap.data().status || '').trim().toLowerCase()
          : '';
        restoredStatus =
          summaryStatus && summaryStatus !== RequestStatus.archived
            ? summaryStatus
            : RequestStatus.pending;
        update.status = restoredStatus;
      }

      tx.update(requestRef, update);
    });

    await logAdminAction(
      adminUser,
      'RESTORE_REQUEST',
      requestId,
      restoredStatus
        ? `Legacy archived request restored as ${restoredStatus}`
        : 'Blood request restored from archive'
    );
    return { success: true, restoredStatus };
  } catch (error) {
    console.error('Error restoring request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Permanently delete a finished request together with its donor offers and
 * its request_summaries entry, so nothing is left for donors to see.
 */
export async function deleteRequest(requestId, adminUser) {
  try {
    const requestRef = doc(db, 'blood_requests', requestId);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) return { success: true };

    const status = requestSnap.data().status;
    const legacyArchived = String(status || '').trim().toLowerCase() === RequestStatus.archived;
    if (!canArchiveRequest(status) && !legacyArchived) {
      throw new Error(
        `Only finished requests can be deleted; this one is "${requestStatusLabel(status || RequestStatus.pending)}".`
      );
    }

    const offersSnap = await getDocs(collection(db, 'blood_requests', requestId, 'offers'));
    // One batch holds 500 writes; a request never has close to that many offers.
    const batch = writeBatch(db);
    offersSnap.docs.forEach((offer) => batch.delete(offer.ref));
    batch.delete(doc(db, 'request_summaries', requestId));
    batch.delete(requestRef);
    await batch.commit();

    await logAdminAction(
      adminUser,
      'DELETE_REQUEST',
      requestId,
      `Blood request deleted with ${offersSnap.size} offer(s) and its summary`
    );
    return { success: true };
  } catch (error) {
    console.error('Error deleting request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Keep blood_requests and request_summaries "matched" in step with the offers.
 *
 * - approved/active and confirmed donors cover the units needed -> matched.
 *   The app then hides it from donors (openToDonors is approved/active) and
 *   firestore.rules stop new offers.
 * - matched but a confirmed donor withdrew -> active again (what approval
 *   writes), so the request is shown to donors and accepts offers.
 *
 * Each confirmed or donated offer covers one unit. Safe to call repeatedly.
 * Resolves to { success, status, changed }.
 */
export async function reconcileMatchedStatus(requestId, adminUser) {
  try {
    const requestRef = doc(db, 'blood_requests', requestId);
    const summaryRef = doc(db, 'request_summaries', requestId);
    const offers = await getDocs(collection(db, 'blood_requests', requestId, 'offers'));
    const covered = offers.docs.filter((o) => countsTowardMatch(o.data().status)).length;

    let result = { status: null, changed: false };
    await runTransaction(db, async (tx) => {
      const requestSnap = await tx.get(requestRef);
      const summarySnap = await tx.get(summaryRef);
      if (!requestSnap.exists()) throw new Error('Blood request no longer exists.');

      const request = requestSnap.data();
      const status = String(request.status || '').trim().toLowerCase();
      const needed = unitsNeededOf(request);
      let next = null;
      if ((status === RequestStatus.approved || status === RequestStatus.active) && covered >= needed) {
        next = RequestStatus.matched;
      } else if (status === RequestStatus.matched && covered < needed) {
        next = RequestStatus.active;
      }
      result = { status: next || status, changed: Boolean(next) };
      if (!next) return;

      const stamp = next === RequestStatus.matched ? 'matchedAt' : 'reopenedAt';
      tx.update(requestRef, { status: next, [stamp]: serverTimestamp(), updatedAt: serverTimestamp() });
      if (summarySnap.exists()) {
        tx.update(summaryRef, { status: next, updatedAt: serverTimestamp() });
      }
    });

    if (result.changed) {
      await logAdminAction(
        adminUser,
        `UPDATE_REQUEST_STATUS_${result.status.toUpperCase()}`,
        requestId,
        result.status === RequestStatus.matched
          ? `Confirmed donors cover the units needed (${covered})`
          : `Reopened to donors: confirmed donors (${covered}) no longer cover the units needed`
      );
    }
    return { success: true, ...result, covered };
  } catch (error) {
    console.error('Error updating matched status:', error);
    return { success: false, error: error.message };
  }
}
