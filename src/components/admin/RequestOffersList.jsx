import { useEffect, useState } from "react";
import { useAuth } from "../../context/useAuth";
import {
  reconcileMatchedStatus,
  subscribeToRequestOffers,
  updateOfferStatus,
} from "../../services/firestore/requestService";
import {
  OfferStatus,
  RequestStatus,
  countsTowardMatch,
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

const RequestOffersList = ({ requestId, requestStatus, unitsNeeded = 1 }) => {
  const { currentUser } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

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
    setNotice("");
    const result = await updateOfferStatus(requestId, offer.id, newStatus, currentUser);
    if (!result.success) setActionError(result.error || "Could not update the offer.");
    else if (result.match?.changed && result.match.status === RequestStatus.matched) {
      setNotice("Confirmed donors now cover every unit needed. The request is marked Donor matched and no longer takes new offers.");
    } else if (result.match && !result.match.success) {
      setActionError(`Offer saved, but the request status could not be updated: ${result.match.error}`);
    }
    setBusyId("");
  };

  const handleReopen = async () => {
    setBusyId("reopen");
    setActionError("");
    setNotice("");
    const result = await reconcileMatchedStatus(requestId, currentUser);
    if (!result.success) setActionError(result.error || "Could not reopen the request.");
    else if (result.changed) setNotice("The request is open to donors again and accepts new offers.");
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
  const covered = offers.filter((o) => countsTowardMatch(o.status)).length;
  // A confirmed donor withdrew after the request was matched.
  const matchedButShort = requestStatus === RequestStatus.matched && covered < unitsNeeded;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
        Donor Offers ({activeCount} active / {offers.length} total)
      </h4>

      <p className="text-xs text-gray-600">
        Confirmed donors cover <span className="font-bold text-gray-900 tabular-nums">{Math.min(covered, unitsNeeded)}</span> of{" "}
        <span className="font-bold text-gray-900 tabular-nums">{unitsNeeded}</span> unit{unitsNeeded === 1 ? "" : "s"} needed.
        {requestOpen && requestStatus !== RequestStatus.matched && covered < unitsNeeded &&
          " The request is marked Donor matched automatically once every unit is covered."}
      </p>

      {matchedButShort && (
        <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <span>A confirmed donor withdrew, so this matched request is short of donors and is hidden from donors in the app.</span>
          <button
            disabled={!!busyId}
            onClick={handleReopen}
            className="shrink-0 px-3 py-1 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
          >
            {busyId === "reopen" ? "Reopening..." : "Reopen to donors"}
          </button>
        </div>
      )}

      {notice && (
        <div role="status" className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          {notice}
        </div>
      )}

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
