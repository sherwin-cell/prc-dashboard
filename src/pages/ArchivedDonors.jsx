import React, { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { LuArchive, LuRotateCcw, LuCheck } from "react-icons/lu";
import DonorDetail from "../features/donors/DonorDetail";

const ArchivedDonors = () => {
  const [archivedDonors, setArchivedDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [banner, setBanner] = useState({ show: false, message: "" });

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    donorId: null,
    donorName: "",
  });

  const fetchArchivedDonors = async () => {
    try {
      setLoading(true);
      // Query both field possibilities ('status' or 'donorStatus') to ensure complete data sync
      const q1 = query(collection(db, "donors"), where("status", "==", "archived"));
      const q2 = query(collection(db, "donors"), where("donorStatus", "==", "archived"));

      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const map = new Map();
      snapshot1.docs.forEach((docItem) => map.set(docItem.id, { id: docItem.id, ...docItem.data() }));
      snapshot2.docs.forEach((docItem) => map.set(docItem.id, { id: docItem.id, ...docItem.data() }));

      setArchivedDonors(Array.from(map.values()));
    } catch (error) {
      console.error("Error fetching archived donors:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedDonors();
  }, []);

  const handleRestoreConfirm = async () => {
    const { donorId, donorName } = confirmModal;
    if (!donorId) return;

    try {
      const donorRef = doc(db, "donors", donorId);
      await updateDoc(donorRef, {
        status: "pending",
        donorStatus: "pending", // Update both to ensure compatibility
        updatedAt: serverTimestamp(),
      });

      setArchivedDonors((prev) => prev.filter((donor) => donor.id !== donorId));
      setBanner({ show: true, message: `Successfully restored application for ${donorName}!` });
      setTimeout(() => setBanner({ show: false, message: "" }), 4000);
      setConfirmModal({ isOpen: false, donorId: null, donorName: "" });
    } catch (error) {
      console.error("Error restoring donor:", error);
      alert(`Failed to restore donor: ${error.message}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading archived donors...</div>;
  }

  if (selectedDonor) {
    return <DonorDetail donor={selectedDonor} onBack={() => setSelectedDonor(null)} />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {banner.show && (
        <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold shadow-xs transition-all">
          <LuCheck size={18} className="text-emerald-600 shrink-0" />
          <span>{banner.message}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-50 border border-gray-200 text-gray-600 rounded-xl flex items-center justify-center shrink-0">
          <LuArchive size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Archived Donors</h1>
          <p className="text-xs text-gray-500">View or restore previously archived donor application records</p>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {archivedDonors.length === 0 ? (
          <div className="p-12 text-center text-sm font-semibold text-gray-500">
            No archived donor applications found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                  <th className="p-4 pl-6">Donor Name</th>
                  <th className="p-4">Blood Type</th>
                  <th className="p-4">Chapter</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {archivedDonors.map((donor) => {
                  const donorName = donor.fullName || donor.name || "Anonymous Donor";
                  return (
                    <tr 
                      key={donor.id} 
                      onClick={() => setSelectedDonor(donor)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                    >
                      <td className="p-4 pl-6 font-semibold text-gray-900">
                        {donorName}
                        <span className="block font-normal text-[11px] text-gray-400">{donor.email || "No email provided"}</span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-red-50 text-[#D32F2F] font-extrabold rounded-full border border-red-100">
                          {donor.bloodType || "N/A"}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-gray-700">{donor.chapter || "N/A"}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase rounded-full">
                          Archived
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setConfirmModal({
                            isOpen: true,
                            donorId: donor.id,
                            donorName: donorName
                          })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold transition-colors border border-emerald-200/60 shadow-2xs"
                        >
                          <LuRotateCcw size={13} /> Restore
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              Confirm Restoration
            </h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to restore the donor application for{" "}
              <span className="font-semibold text-gray-900">{confirmModal.donorName}</span>?
            </p>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setConfirmModal({ isOpen: false, donorId: null, donorName: "" })}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreConfirm}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
              >
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivedDonors;