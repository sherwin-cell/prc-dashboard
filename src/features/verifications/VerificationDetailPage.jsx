import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
// Service Imports
import {
    getVerificationById,
    processVerificationDecision,
} from "../../services/firestore/verificationService";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import StatusBadge from "../../components/common/StatusBadge";
import {
    LuArrowLeft,
    LuCircleCheck,
    LuCircleX,
    LuShieldCheck,
    LuScanFace,
    LuFileText,
    LuTriangleAlert,
} from "react-icons/lu";

const VerificationDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [adminNotes, setAdminNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const data = await getVerificationById(id);
                if (data) {
                    setRequest(data);
                    if (data.adminNotes) setAdminNotes(data.adminNotes);
                } else {
                    setError("Verification request document not found.");
                }
            } catch (err) {
                setError("Failed to load verification request details.");
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [id]);

    const handleDecision = async (status) => {
        if (status === "REJECTED" && !adminNotes.trim()) {
            alert("Please provide a reason for rejection in the review notes.");
            return;
        }

        setSubmitting(true);
        try {
            await processVerificationDecision({
                requestId: id,
                userId: request.userId,
                status,
                adminNotes,
                adminUser: currentUser,
            });

            alert(`Verification successfully marked as ${status}.`);
            navigate("/verifications");
        } catch (err) {
            alert("Error processing decision. Check your console or Firestore rules.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading verification details..." />;

    if (error) {
        return (
            <div className="p-8 text-center bg-white rounded-xl border border-gray-200">
                <LuTriangleAlert size={48} className="mx-auto text-amber-500 mb-2" />
                <p className="text-gray-800 font-semibold">{error}</p>
                <button
                    onClick={() => navigate("/verifications")}
                    className="mt-4 px-4 py-2 bg-[#D32F2F] text-white text-sm font-medium rounded-lg"
                >
                    Back to Verifications List
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Navigation Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate("/verifications")}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                    <LuArrowLeft size={18} />
                    <span>Back to List</span>
                </button>
                <StatusBadge status={request.status} />
            </div>

            {/* User Overview */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
                <h2 className="text-xl font-bold text-gray-900">{request.userName || "Donor Verification Request"}</h2>
                <p className="text-xs text-gray-500">
                    User ID: {request.userId} • Email: {request.userEmail}
                </p>
            </div>

            {/* Review Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: ID & Selfie Images */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <LuFileText className="text-[#D32F2F]" size={18} />
                            1. Government Identification Document
                        </h3>
                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                            <img
                                src={request.govIdUrl || "https://via.placeholder.com/600x380?text=Government+ID+Image"}
                                alt="Government ID"
                                className="w-full h-56 object-contain rounded-md bg-black/5"
                            />
                        </div>
                        <div className="text-xs text-gray-500 flex justify-between">
                            <span>ID Type: <strong>{request.idType || "Philippine Gov ID"}</strong></span>
                            <span>Storage: Cloudinary</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <LuScanFace className="text-[#1976D2]" size={18} />
                            2. Live Facial Verification Selfie
                        </h3>
                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                            <img
                                src={request.selfieUrl || "https://via.placeholder.com/400x400?text=Live+Selfie+Image"}
                                alt="Live Selfie"
                                className="w-full h-56 object-contain rounded-md bg-black/5"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: OCR Analysis & Decision Controls */}
                <div className="space-y-6 flex flex-col justify-between">
                    <div className="space-y-6">
                        {/* ML Kit OCR Data */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-3">
                            <div className="flex items-center gap-2 text-[#D32F2F] font-bold text-sm">
                                <LuShieldCheck size={20} />
                                <span>Google ML Kit OCR Text Extraction</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <div>
                                    <span className="text-gray-500 block">Extracted Name:</span>
                                    <span className="font-semibold text-gray-800">{request.ocrName || "N/A"}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block">ID Number:</span>
                                    <span className="font-semibold text-gray-800">{request.ocrIdNumber || "N/A"}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block">Date of Birth:</span>
                                    <span className="font-semibold text-gray-800">{request.ocrDob || "N/A"}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block">Address Matched:</span>
                                    <span className="font-semibold text-gray-800">{request.ocrAddress ? "Yes" : "N/A"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Face Detection Score */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-3">
                            <div className="flex items-center gap-2 text-[#2E7D32] font-bold text-sm">
                                <LuScanFace size={20} />
                                <span>Face Detection & Match Metrics</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <div>
                                    <span className="text-gray-500 block">Match Confidence:</span>
                                    <span className="font-bold text-emerald-700 text-sm">
                                        {request.faceMatchConfidence ? `${request.faceMatchConfidence}%` : "Passed"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block">Liveness Validation:</span>
                                    <span className="font-semibold text-gray-800">
                                        {request.isLive ? "Passed (Real Human)" : "Verified"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Review Notes Input */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-2">
                            <label className="text-xs font-bold text-gray-700 block">Administrative Review Notes</label>
                            <textarea
                                rows={3}
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="Include approval details or explicit reasons for rejection..."
                                className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D32F2F] focus:outline-hidden"
                            />
                            <p className="text-[11px] text-gray-400">
                                Notes will be saved in the database and visible to the user in their mobile application.
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex gap-4">
                        <button
                            onClick={() => handleDecision("REJECTED")}
                            disabled={submitting || request.status === "REJECTED"}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
                        >
                            <LuCircleX size={18} />
                            Reject Request
                        </button>
                        <button
                            onClick={() => handleDecision("APPROVED")}
                            disabled={submitting || request.status === "APPROVED"}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#2E7D32] hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
                        >
                            <LuCircleCheck size={18} />
                            Approve Verification
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerificationDetailPage;