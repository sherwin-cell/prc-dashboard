import React, { useEffect, useState } from "react";
import { db } from "../../firebase/config";
import { collection, onSnapshot, doc, updatedoc, serverTimestamp } from "firebase/firestore";

const RequestOffersList = ({ requestId }) => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const offersRef = collection(db, "blood_requests", requestId, "offers");
    
    const unsubscribe = onSnapshot(offersRef, (snapshot) => {
      const fetchedOffers = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));
      setOffers(fetchedOffers);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to offers:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [requestId]);

  const handleUpdateOfferStatus = async (offerId, newStatus) => {
    try {
      const offerRef = doc(db, "blood_requests", requestId, "offers", offerId);
      await updatedoc(offerRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating offer status:", error);
    }
  };

  if (loading) {
    return <div className="text-xs text-gray-500 py-2">Loading donor offers...</div>;
  }

  if (offers.length === 0) {
    return <div className="text-xs text-gray-400 italic py-2">No donor offers received yet.</div>;
  }

  return (
    <div className="space-y-3 mt-4 border-t border-gray-100 pt-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
        Volunteer Offers ({offers.length})
      </h4>
      <div className="grid gap-3">
        {offers.map((offer) => (
          <div key={offer.id} className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-gray-900">{offer.donorName}</span>
                <span className="px-2 py-0.5 bg-red-100 text-[#D32F2F] text-[10px] font-bold rounded-full">
                  {offer.donorBloodType}
                </span>
              </div>
              <p className="text-xs text-gray-600">Contact: <span className="font-medium text-gray-800">{offer.donorContact}</span></p>
              <p className="text-[10px] text-gray-400">Status: <span className="uppercase font-semibold">{offer.status}</span></p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {offer.status === "pending" && (
                <>
                  <button
                    onClick={() => handleUpdateOfferStatus(offer.id, "rejected")}
                    className="flex-1 sm:flex-none px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleUpdateOfferStatus(offer.id, "approved")}
                    className="flex-1 sm:flex-none px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                  >
                    Confirm Match
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RequestOffersList;