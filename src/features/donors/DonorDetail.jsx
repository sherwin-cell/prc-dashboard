import React, { useState } from "react";
import { LuShieldCheck, LuArrowLeft } from "react-icons/lu";

const DonorDetail = ({ donor, onBack }) => {
  const [donorData] = useState(donor || {});

  const formatYesNo = (val) => {
    if (val === true) return <span className="text-green-600 font-medium">Yes</span>;
    if (val === false) return <span className="text-gray-600 font-medium">No</span>;
    return <span className="text-gray-400">Not answered</span>;
  };

  const frontImage = 
    donorData.frontIdImageUrl || 
    donorData.idVerification?.frontIdImageUrl || 
    donorData.idVerificationData?.frontIdImageUrl;
    
  const backImage = 
    donorData.backIdImageUrl || 
    donorData.idVerification?.backIdImageUrl || 
    donorData.idVerificationData?.backIdImageUrl;

  const idType = 
    donorData.idType || 
    donorData.idVerification?.idType || 
    donorData.idVerificationData?.idType || 
    "Government ID";

  const answers = donorData.eligibilityAnswers || {};

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
          <h1 className="text-xl font-bold text-gray-900">Donor Application Details</h1>
          <p className="text-xs text-gray-500">Comprehensive overview of donor screening and ID verification</p>
        </div>
      </div>

      {/* Detailed Card Layout */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{donorData.fullName || donorData.displayName || "Anonymous Donor"}</h3>
            <p className="text-xs text-gray-500">{donorData.email || "No email provided"}</p>
          </div>
          <span className="px-3 py-1 bg-red-50 text-[#D32F2F] text-xs font-extrabold rounded-full border border-red-100">
            {donorData.bloodType || "N/A"}
          </span>
        </div>

        {/* Donor Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <strong className="text-gray-700 block mb-0.5">Chapter:</strong>
            <span className="text-gray-900 font-medium">{donorData.chapter || "N/A"}</span>
          </div>
          <div>
            <strong className="text-gray-700 block mb-0.5">Available for Donation:</strong>
            <span className="text-gray-900 font-medium">{donorData.isAvailableForDonation ? "Yes" : "No"}</span>
          </div>
          <div>
            <strong className="text-gray-700 block mb-0.5">Last Donation Date:</strong>
            <span className="text-gray-900 font-medium">
              {donorData.lastDonationDate 
                ? new Date(donorData.lastDonationDate.seconds ? donorData.lastDonationDate.seconds * 1000 : donorData.lastDonationDate).toLocaleDateString() 
                : "None / Never"}
            </span>
          </div>
        </div>

        {/* Eligibility Answers */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Eligibility Screening Responses</h4>
          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between"><span>Feels Healthy:</span> {formatYesNo(answers.feelsHealthy)}</div>
            <div className="flex justify-between"><span>Recent Illness:</span> {formatYesNo(answers.hasRecentIllness)}</div>
            <div className="flex justify-between"><span>Recent Medication:</span> {formatYesNo(answers.hasRecentMedication)}</div>
            <div className="flex justify-between"><span>Tattoo / Piercing:</span> {formatYesNo(answers.hasRecentTattooOrPiercing)}</div>
            <div className="flex justify-between col-span-full"><span>Donated Recently:</span> {formatYesNo(answers.hasDonatedRecently)}</div>
          </div>
        </div>

        {/* ID Verification Section */}
        {(frontImage || backImage) ? (
          <div className="border border-blue-100 bg-blue-50/40 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <LuShieldCheck size={16} className="text-blue-600" />
                {idType} Verified Submission
              </span>
            </div>

            <div className="flex gap-4 pt-2 border-t border-blue-100/60">
              {frontImage && (
                <a
                  href={frontImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#D32F2F] font-semibold flex items-center gap-1 hover:underline"
                >
                  View Front ID
                </a>
              )}
              {backImage && (
                <a
                  href={backImage}
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
            No identity verification images attached to this donor application.
          </div>
        )}
      </div>
    </div>
  );
};

export default DonorDetail;