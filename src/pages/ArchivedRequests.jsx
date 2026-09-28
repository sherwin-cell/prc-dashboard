import React, { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { LuArchive, LuRotateCcw, LuCheck } from "react-icons/lu";

const ArchivedRequests = () => {
  const [archivedList, setArchivedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState({ show: false, message: "" });

  // Fetch only archived blood requests
  const fetchArchivedRequests = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "blood_requests"), where("status", "==", "archived"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));
      setArchivedList(data);
    } catch (error) {
      console.error("Error fetching archived requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedRequests();
  }, []);

  // Restore/Unarchive action back to pending
  const handleRestore = async (req) => {
    try {
      const ref = doc(db, "blood_requests", req.id);
      await updateDoc(ref, { status: "pending", updatedAt: serverTimestamp() });
      
      // Remove from archive list state
      setArchivedList((prev) => prev.filter((item) => item.id !== req.id));

      setBanner({ show: true, message: `Successfully restored request for ${req.patientName || "Patient"}!` });
      setTimeout(() => setBanner({ show: false, message: "" }), 4000);
    } catch (err) {
      console.error("Error restoring request:", err);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500 font-medium">Loading archives...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Confirmation Banner */}
      {banner.show && (
        <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold shadow-xs">
          <LuCheck size={18} className="text-emerald-600 shrink-0" />
          <span>{banner.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-200 flex items-center gap-3">
        <div className="p-2.5 bg-gray-100 rounded-xl text-gray-700">
          <LuArchive size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Archived Blood Requests</h1>
          <p className="text-xs text-gray-500">View or restore previously archived request records</p>
        </div>
      </div>

      {/* Table view */}
      <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blood Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hospital</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {archivedList.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-sm text-gray-400">
                  No archived requests found.
                </td>
              </tr>
            ) : (
              archivedList.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{req.patientName || "Unnamed"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2.5 py-1 bg-red-50 text-[#D32F2F] text-xs font-bold rounded-full border border-red-100">
                      {req.bloodType || "O+"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{req.hospital || "N/A"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase bg-gray-100 text-gray-700">
                      Archived
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => handleRestore(req)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold rounded-xl transition-colors"
                    >
                      <LuRotateCcw size={14} /> Restore
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArchivedRequests;