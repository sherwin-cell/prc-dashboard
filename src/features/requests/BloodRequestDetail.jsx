import { useEffect, useState } from "react";
import { db } from "../../firebase/config";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { LuShieldCheck, LuArrowLeft, LuFileText, LuBan, LuBellRing } from "react-icons/lu";
import { useAuth } from "../../context/AuthContext";
import RequestOffersList from "../../components/admin/RequestOffersList";
import {
  markRequestFulfilled,
  subscribeToRequest,
} from "../../services/firestore/requestService";
import {
  RequestStatus,
  isRequestOpen,
  requestStatusClasses,
  requestStatusLabel,
  unitsNeededOf,
} from "../../constants/statuses";

const CONFIRM_COPY = {
  approve: { title: "Confirm Approval", verb: "approve", button: "Yes, Approve", color: "bg-emerald-600 hover:bg-emerald-700" },
  reject: { title: "Confirm Rejection", verb: "reject", button: "Yes, Reject", color: "bg-rose-600 hover:bg-rose-700" },
  fulfill: { title: "Mark Request Fulfilled", verb: "mark as fulfilled", button: "Yes, Mark Fulfilled", color: "bg-blue-600 hover:bg-blue-700" },
};

const BloodRequestDetail = ({ request, onBack, onUpdateStatus }) => {
  const { currentUser } = useAuth();
  const [reqData, setReqData] = useState(request);
  const [actionError, setActionError] = useState("");
  // Shown to the requester in the app (rejectionReason).
  const [rejectionReason, setRejectionReason] = useState("");

  // Keep the request live so a cancellation from the mobile app shows up
  // immediately and PRC stops acting on it.
  useEffect(() => {
    return subscribeToRequest(
      request.id,
      (latest) => {
        if (latest) setReqData(latest);
      },
      (error) => console.error("Error listening to blood request:", error)
    );
  }, [request.id]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, actionType: null });

  const handleConfirmAction = async () => {
    const actionType = confirmModal.actionType;
    if (!actionType) return;
    setActionError("");

    if (actionType === "fulfill") {
      const result = await markRequestFulfilled(reqData.id, currentUser);
      if (result.success) {
        const updated = { ...reqData, status: RequestStatus.fulfilled };
        setReqData(updated);
        if (onUpdateStatus) onUpdateStatus(updated);
      } else {
        setActionError(result.error || "Could not mark the request fulfilled.");
      }
      setConfirmModal({ isOpen: false, actionType: null });
      return;
    }

    if (reqData.status !== RequestStatus.pending) {
      setActionError(`This request is "${requestStatusLabel(reqData.status)}" and can no longer be reviewed.`);
      setConfirmModal({ isOpen: false, actionType: null });
      return;
    }

    try {
      // A published (PRC-approved) blood request is "active"; the ID
      // verification submission keeps its own approved/rejected status.
      const newStatus = actionType === "approve" ? "active" : "rejected";
      const reason = rejectionReason.trim();
      if (actionType === "reject" && !reason) {
        setActionError("Enter a reason for the requester before rejecting.");
        return;
      }
      const idVerificationStatus = actionType === "approve" ? "approved" : "rejected";
      const submissionId = reqData.idVerificationSubmissionId;

      const batch = writeBatch(db);
      const requestRef = doc(db, "blood_requests", reqData.id);

      batch.update(requestRef, {
        status: newStatus,
        // The backend times the approval/rejection notice from reviewedAt.
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser?.uid || "admin",
        // The app shows this on the rejected request (RequestProgress).
        ...(actionType === "reject" ? { rejectionReason: reason } : {}),
        updatedAt: serverTimestamp(),
      });

      // Anonymized summary shown to donors (no patient identity, requester
      // contact details or Blood Request Form). Donors cannot read
      // blood_requests, so this is all they see. Only for published requests.
      if (actionType === "approve") {
        batch.set(doc(db, "request_summaries", reqData.id), {
          requestId: reqData.id,
          bloodType: reqData.bloodType ?? null,
          component: reqData.component ?? null,
          unitsRequired: reqData.unitsRequired ?? null,
          urgency: reqData.urgency ?? null,
          // The hospital is shown to donors; the patient stays anonymous.
          hospitalName: reqData.hospitalName ?? null,
          neededByDate:
            reqData.neededByDate ?? reqData.neededBy ?? reqData.requiredDate ?? null,
          status: "active",
          createdAt: reqData.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (submissionId) {
        const verificationRef = doc(db, "id_verifications", submissionId);
        batch.update(verificationRef, {
          status: idVerificationStatus,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      const updated = {
        ...reqData,
        status: newStatus,
        ...(actionType === "reject" ? { rejectionReason: reason } : {}),
      };
      setReqData(updated);
      if (onUpdateStatus) onUpdateStatus(updated);

      setRejectionReason("");
      setConfirmModal({ isOpen: false, actionType: null });
    } catch (error) {
      console.error(`Error ${actionType}ing request:`, error);
      setActionError(error.message || `Could not ${actionType} the request.`);
      setConfirmModal({ isOpen: false, actionType: null });
    }
  };

  const formatDate = (val) => {
    if (!val) return "Not Specified";
    if (val.seconds) {
      return new Date(val.seconds * 1000).toLocaleDateString();
    }
    return val;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-3 border-b pb-4">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition"
          title="Back to List"
        >
          <LuArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Blood Request Details</h1>
          <p className="text-xs text-gray-500">Comprehensive overview of patient request, medical records, and verification status</p>
        </div>
      </div>

      {reqData.status === RequestStatus.cancelled && (
        <div role="status" className="flex items-start gap-2.5 p-4 bg-gray-100 border border-gray-300 text-gray-800 rounded-2xl text-xs">
          <LuBan size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">The requester cancelled this request.</p>
            <p className="text-gray-600">No further PRC action is needed. Pending donor offers can still be declined to close them out.</p>
          </div>
        </div>
      )}

      {actionError && (
        <div role="alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold">
          {actionError}
        </div>
      )}

      {/* Detailed Card Layout */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
        {/* Top Info */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{reqData.patientName || "Unnamed Patient"}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">Status:</span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${requestStatusClasses(reqData.status)}`}
              >
                {requestStatusLabel(reqData.status)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="px-3 py-1 bg-red-50 text-[#D32F2F] text-xs font-extrabold rounded-full border border-red-100">
              {reqData.bloodType || "O+"}
            </span>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              {reqData.urgency || "Normal"} Urgency
            </span>
          </div>
        </div>

        {/* 1. Patient Details Grid */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Patient Profile</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <strong className="text-gray-700 block mb-0.5">Patient Name:</strong>
              <span className="text-gray-900 font-medium">{reqData.patientName || "N/A"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Age / Sex / Birthday:</strong>
              <span className="text-gray-900 font-medium">
                {reqData.patientAge || "N/A"} yrs / {reqData.patientSex || "N/A"} / {reqData.patientBirthday || "N/A"}
              </span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Contact Number:</strong>
              <span className="text-gray-900 font-medium">{reqData.contactNumber || "N/A"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Relative / Contact Person:</strong>
              <span className="text-gray-900 font-medium">{reqData.relativeName || "N/A"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Relationship to Patient:</strong>
              <span className="text-gray-900 font-semibold">{reqData.relationship || "Not specified"}</span>
            </div>
          </div>
        </div>

        {/* 2. Blood Specifications Grid */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Blood & Clinical Specifications</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <strong className="text-gray-700 block mb-0.5">Blood Type Needed:</strong>
              <span className="text-gray-900 font-medium">{reqData.bloodType || "O+"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Units Required:</strong>
              <span className="text-gray-900 font-medium">{reqData.unitsRequired || reqData.unitsNeeded || 1}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Blood Component:</strong>
              <span className="text-gray-900 font-medium">{reqData.component || "Whole Blood"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Hemoglobin / Hematocrit:</strong>
              <span className="text-gray-900 font-medium">{reqData.hemoglobin || "N/A"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Target Date Needed:</strong>
              <span className="text-gray-900 font-medium">{formatDate(reqData.neededByDate || reqData.requiredDate)}</span>
            </div>
          </div>
        </div>

        {/* 3. Hospital & Physician Information */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Hospital & Physician Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <strong className="text-gray-700 block mb-0.5">Hospital Name:</strong>
              <span className="text-gray-900 font-medium">{reqData.hospitalName || reqData.hospital || "N/A"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Clinical Diagnosis:</strong>
              <span className="text-gray-900 font-medium">{reqData.clinicalDiagnosis || "N/A"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Attending Physician:</strong>
              <span className="text-gray-900 font-medium">{reqData.attendingPhysician || "N/A"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">Requesting Physician & License:</strong>
              <span className="text-gray-900 font-medium">{reqData.requestingPhysician || "N/A"}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">BRF Document Date:</strong>
              <span className="text-gray-900 font-medium">{formatDate(reqData.brfDate)}</span>
            </div>
            <div>
              <strong className="text-gray-700 block mb-0.5">
                BRF PDF File:
              </strong>

              {reqData.brfFileUrl ? (
                <div className="mt-1 flex flex-col gap-2">
                  <span className="text-gray-900 font-medium break-all">
                    {reqData.brfFileName || "Blood Request Form.pdf"}
                  </span>

                  <a
                    href={reqData.brfFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 w-fit px-3 py-1.5
                   bg-red-50 text-[#D32F2F]
                   border border-red-100
                   rounded-lg text-xs font-semibold
                   hover:bg-red-100 transition"
                  >
                    <LuFileText size={15} />
                    View BRF PDF
                  </a>
                </div>
              ) : (
                <span className="text-gray-400">
                  No BRF PDF uploaded
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Notes & Other Info */}
        {reqData.notes && (
          <div className="bg-amber-50/70 border border-amber-200/60 p-3.5 rounded-xl text-xs space-y-1">
            <strong className="text-amber-900 block font-bold uppercase tracking-wider text-[10px]">
              Special Notes:
            </strong>
            <p className="text-amber-950 font-medium italic">"{reqData.notes}"</p>
          </div>
        )}

        {reqData.otherInfo && (
          <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl text-xs space-y-1">
            <strong className="text-gray-800 block font-bold uppercase tracking-wider text-[10px]">
              Other Information:
            </strong>
            <p className="text-gray-900 font-medium">{reqData.otherInfo}</p>
          </div>
        )}

        {/* ID Verification Section */}
        {reqData.idVerification ? (
          <div className="border border-blue-100 bg-blue-50/40 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <LuShieldCheck size={16} className="text-blue-600" />
                ID Verification ({reqData.idVerification.idType || "Government ID"})
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-800">
                {reqData.idVerification.validationStatus || "verified"}
              </span>
            </div>

            <div className="flex gap-4 pt-2 border-t border-blue-100/60">
              {reqData.idVerification.frontIdImageUrl && (
                <a
                  href={reqData.idVerification.frontIdImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#D32F2F] font-semibold flex items-center gap-1 hover:underline"
                >
                  View Front ID
                </a>
              )}
              {reqData.idVerification.backIdImageUrl && (
                <a
                  href={reqData.idVerification.backIdImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#D32F2F] font-semibold flex items-center gap-1 hover:underline"
                >
                  View Back ID
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 italic">
            No identity verification attached to this specific request entry.
          </div>
        )}

        {/* Action Controls */}
        <div className="flex gap-3 pt-2">
          {reqData.status === "pending" ? (
            <>
              <button
                onClick={() => setConfirmModal({ isOpen: true, actionType: "reject" })}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors"
              >
                Reject Request
              </button>
              <button
                onClick={() => setConfirmModal({ isOpen: true, actionType: "approve" })}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
              >
                Approve Request
              </button>
            </>
          ) : isRequestOpen(reqData.status) ? (
            <button
              onClick={() => setConfirmModal({ isOpen: true, actionType: "fulfill" })}
              className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
            >
              Mark Request Fulfilled
            </button>
          ) : (
            <div className="w-full text-center py-2 text-xs font-medium text-gray-400 bg-gray-50 rounded-xl border border-gray-100 uppercase tracking-wider">
              {requestStatusLabel(reqData.status)}
            </div>
          )}
        </div>

        {reqData.status === RequestStatus.rejected && (reqData.rejectionReason || reqData.adminNotes) && (
          <div className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/60 text-xs text-rose-900">
            <span className="font-bold">Reason shown to the requester:</span> {reqData.rejectionReason || reqData.adminNotes}
          </div>
        )}

        {/* Donors alerted on approval: written by blood_connect_backend
            (notification worker) as matchingDonorsNotified; only a count. */}
        {reqData.status && reqData.status !== RequestStatus.pending && reqData.status !== RequestStatus.rejected && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-blue-100 bg-blue-50/60 text-xs">
            <LuBellRing size={16} className="text-blue-600 shrink-0 mt-0.5" />
            {typeof reqData.matchingDonorsNotified === "number" ? (
              reqData.matchingDonorsNotified > 0 ? (
                <p className="text-blue-900">
                  <span className="font-black tabular-nums">{reqData.matchingDonorsNotified}</span>{" "}
                  matching donor{reqData.matchingDonorsNotified === 1 ? "" : "s"} alerted when this request was approved.
                </p>
              ) : (
                <p className="text-blue-900">
                  <span className="font-bold">No matching donors were alerted.</span> Either the requester has no
                  municipality or province on their profile, or no available {reqData.bloodType || ""} donors live nearby.
                  The request is still listed for donors in the app.
                </p>
              )
            ) : (
              <p className="text-blue-900">
                Donor alerts not recorded yet. The backend notification worker records the count shortly after
                approval; if this stays empty, check that the backend is running.
              </p>
            )}
          </div>
        )}

        {/* Donor offers (only once PRC has reviewed the request) */}
        {reqData.status && reqData.status !== RequestStatus.pending && reqData.status !== RequestStatus.rejected && (
          <div className="border-t border-gray-100 pt-4">
            <RequestOffersList requestId={reqData.id} requestStatus={reqData.status} unitsNeeded={unitsNeededOf(reqData)} />
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              {CONFIRM_COPY[confirmModal.actionType]?.title}
            </h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to <span className="font-semibold">{CONFIRM_COPY[confirmModal.actionType]?.verb}</span> the blood request for{" "}
              <span className="font-semibold text-gray-900">{reqData.patientName}</span>?
            </p>
            {confirmModal.actionType === "reject" && (
              <label className="block text-xs font-semibold text-gray-700">
                Reason shown to the requester
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. The Blood Request Form is unreadable. Please submit a new request with a clear photo."
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs font-normal text-gray-800 focus:outline-none focus:border-rose-500"
                />
              </label>
            )}
            {confirmModal.actionType === "fulfill" && (
              <p className="text-xs text-gray-500">
                Offers still waiting for PRC are declined automatically and those donors are told they were not
                needed. Confirmed donors stay, so you can still record their donations.
              </p>
            )}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setConfirmModal({ isOpen: false, actionType: null })}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={confirmModal.actionType === "reject" && !rejectionReason.trim()}
                className={`flex-1 px-4 py-2.5 text-xs font-semibold text-white rounded-xl transition-colors shadow-xs disabled:opacity-50 ${CONFIRM_COPY[confirmModal.actionType]?.color}`}
              >
                {CONFIRM_COPY[confirmModal.actionType]?.button}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BloodRequestDetail;
