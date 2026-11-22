import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  subscribeToRequestOffers,
  updateOfferStatus,
} from "../../services/firestore/requestService";
import {
  OfferStatus,
  RequestStatus,
  isOfferConfirmed,
  isOfferPending,
  isRequestOpen,
  offerStatusClasses,
  offerStatusLabel,
} from "../../constants/statuses";

// Active offers first, then finished ones, newest first within each group.
const rank = (status) =>
  isOfferPending(status) ? 0 : isOfferConfirmed(status) ? 1 : status === OfferStatus.donated ? 2 : 3;
const millis = (ts) => (ts?.toMillis ? ts.toMillis() : 0);

const RequestOffersList = ({ requestId, requestStatus }) => {
  const { currentUser } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    return subscribeToRequestOffers(
      requestId,
      (items) => {
        setOffers(items);
        setLoadError("");
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to offers:", error);
        setLoadError("Unable to load donor offers. Check Firestore permissions and refresh.");
        setLoading(false);
      }
    );
  }, [requestId]);

  const handleUpdateOfferStatus = async (offer, newStatus) => {
    setBusyId(offer.id);
    setActionError("");
    const result = await updateOfferStatus(requestId, offer.id, newStatus, currentUser);
    if (!result.success) setActionError(result.error || "Could not update the offer.");
    setBusyId("");
  };

  if (loading) {
    return <div className="text-xs text-gray-500 py-2">Loading donor offers...</div>;
  }

  if (loadError) {
    return <div role="alert" className="text-xs text-rose-700 bg-rose-50 rounded-lg p-3">{loadError}</div>;
  }

  const requestOpen = isRequestOpen(requestStatus);
  const canRecordDonation = requestOpen || requestStatus === RequestStatus.fulfilled;
  const sorted = [...offers].sort(
    (a, b) => rank(a.status) - rank(b.status) || millis(b.createdAt) - millis(a.createdAt)
  );
  const activeCount = offers.filter((o) => isOfferPending(o.status) || isOfferConfirmed(o.status)).length;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
        Donor Offers ({activeCount} active / {offers.length} total)
      </h4>

      {actionError && (
        <div role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          {actionError}
        </div>
      )}

      {offers.length === 0 ? (
        <div className="text-xs text-gray-400 italic py-2">No donor offers received yet.</div>
      ) : (
        <div className="grid gap-3">
          {sorted.map((offer) => {
            const pending = isOfferPending(offer.status);
            const confirmed = isOfferConfirmed(offer.status);
            const inactive = !pending && !confirmed;
            const busy = busyId === offer.id;

            return (
              <div
                key={offer.id}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
                  inactive ? "bg-gray-50/60 border-gray-100 opacity-70" : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-bold text-sm text-gray-900 ${offer.status === OfferStatus.withdrawn ? "line-through" : ""}`}>
                      {offer.donorName || "Unnamed donor"}
                    </span>
                    {offer.donorBloodType && (
                      <span className="px-2 py-0.5 bg-red-100 text-[#D32F2F] text-[10px] font-bold rounded-full">
                        {offer.donorBloodType}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${offerStatusClasses(offer.status)}`}>
                      {offerStatusLabel(offer.status)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Contact: <span className="font-medium text-gray-800">{offer.donorContact || "N/A"}</span>
                  </p>
                  {offer.status === OfferStatus.withdrawn && (
                    <p className="text-[11px] text-gray-500">The donor withdrew this offer. No action needed.</p>
                  )}
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  {pending && (
                    <>
                      <button
                        disabled={!!busyId}
                        onClick={() => handleUpdateOfferStatus(offer, OfferStatus.rejected)}
                        className="flex-1 sm:flex-none px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Decline
                      </button>
                      {requestOpen && (
                        <button
                          disabled={!!busyId}
                          onClick={() => handleUpdateOfferStatus(offer, OfferStatus.approved)}
                          className="flex-1 sm:flex-none px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {busy ? "Saving..." : "Confirm Match"}
                        </button>
                      )}
                    </>
                  )}
                  {confirmed && canRecordDonation && (
                    <button
                      disabled={!!busyId}
                      onClick={() => handleUpdateOfferStatus(offer, OfferStatus.donated)}
                      className="flex-1 sm:flex-none px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {busy ? "Saving..." : "Mark Donated"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RequestOffersList;
