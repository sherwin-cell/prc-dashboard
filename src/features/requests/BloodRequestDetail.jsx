import React, { useState } from "react";
import { db } from "../../firebase/config";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { LuShieldCheck, LuArrowLeft } from "react-icons/lu";

const BloodRequestDetail = ({ request, onBack, onUpdateStatus }) => {
  const [reqData, setReqData] = useState(request);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, actionType: null });

  const handleConfirmAction = async () => {
    const actionType = confirmModal.actionType;
    if (!actionType) return;

    try {
      const newStatus = actionType === "approve" ? "approved" : "rejected";
      const submissionId = reqData.idVerificationSubmissionId;

      const batch = writeBatch(db);
      const requestRef = doc(db, "blood_requests", reqData.id);

      batch.update(requestRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      if (submissionId) {
        const verificationRef = doc(db, "id_verifications", submissionId);
        batch.update(verificationRef, {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      const updated = { ...reqData, status: newStatus };
      setReqData(updated);
      if (onUpdateStatus) onUpdateStatus(updated);

      setConfirmModal({ isOpen: false, actionType: null });
    } catch (error) {
      console.error(`Error ${actionType}ing request:`, error);
    }
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
          <p className="text-xs text-gray-500">Comprehensive overview of patient request and verification status</p>
        </div>
      </div>

      {/* Detailed Card Layout */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
        {/* Top Info */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{reqData.patientName || "Unnamed Patient"}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">Status:</span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  reqData.status === "approved"
                    ? "bg-emerald-100 text-emerald-800"
                    : reqData.status === "rejected"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {reqData.status || "pending"}
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

        {/* Patient Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <strong className="text-gray-700 block mb-0.5">Patient Name:</strong>
            <span className="text-gray-900 font-medium">{reqData.patientName || "N/A"}</span>
          </div>
          <div>
            <strong className="text-gray-700 block mb-0.5">Patient Age:</strong>
            <span className="text-gray-900 font-medium">{reqData.patientAge || "N/A"}</span>
          </div>
          <div>
            <strong className="text-gray-700 block mb-0.5">Relationship to Requester:</strong>
            <span className="text-gray-900 font-semibold">{reqData.relationship || "Not specified"}</span>
          </div>
          <div>
            <strong className="text-gray-700 block mb-0.5">Blood Type:</strong>
            <span className="text-gray-900 font-medium">{reqData.bloodType || "O+"}</span>
          </div>
          <div>
            <strong className="text-gray-700 block mb-0.5">Units Required:</strong>
            <span className="text-gray-900">{reqData.unitsRequired || reqData.unitsNeeded || 1}</span>
          </div>
          <div>
            <strong className="text-gray-700 block mb-0.5">Blood Component:</strong>
            <span className="text-gray-900">{reqData.component || "Whole Blood"}</span>
          </div>
        </div>

        {/* Hospital Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <strong className="text-gray-700 block mb-0.5">Hospital:</strong>
            <span className="text-gray-900">{reqData.hospital || "N/A"}</span>
          </div>
          <div>
            <strong className="text-gray-700 block mb-0.5">Hospital Location:</strong>
            <span className="text-gray-900">{reqData.hospitalLocation || "N/A"}</span>
          </div>
          <div>
            <strong className="text-gray-700 block mb-0.5">Target Date Needed:</strong>
            <span className="text-gray-900">
              {reqData.neededByDate?.seconds
                ? new Date(reqData.neededByDate.seconds * 1000).toLocaleDateString()
                : "Not Specified"}
            </span>
          </div>
          <div>
            <strong className="text-gray-700 block mb-0.5">Contact Person:</strong>
            <span className="text-gray-900">{reqData.contactPerson || "N/A"}</span>
          </div>
          <div>
            <strong className="text-gray-700 block mb-0.5">Contact Number:</strong>
            <span className="text-gray-900">{reqData.contactNumber || "N/A"}</span>
          </div>
        </div>

        {/* Notes */}
        {reqData.notes && (
          <div className="bg-amber-50/70 border border-amber-200/60 p-3.5 rounded-xl text-xs space-y-1">
            <strong className="text-amber-900 block font-bold uppercase tracking-wider text-[10px]">
              Special Clinical Notes / Reason:
            </strong>
            <p className="text-amber-950 font-medium italic">"{reqData.notes}"</p>
          </div>
        )}

        {/* ID Verification */}
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
          ) : (
            <div className="w-full text-center py-2 text-xs font-medium text-gray-400 bg-gray-50 rounded-xl border border-gray-100 uppercase tracking-wider">
              Request already {reqData.status}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              Confirm {confirmModal.actionType === "approve" ? "Approval" : "Rejection"}
            </h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to <span className="font-semibold">{confirmModal.actionType}</span> the blood request for{" "}
              <span className="font-semibold text-gray-900">{reqData.patientName}</span>?
            </p>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setConfirmModal({ isOpen: false, actionType: null })}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`flex-1 px-4 py-2.5 text-xs font-semibold text-white rounded-xl transition-colors shadow-xs ${
                  confirmModal.actionType === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                Yes, {confirmModal.actionType === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BloodRequestDetail;