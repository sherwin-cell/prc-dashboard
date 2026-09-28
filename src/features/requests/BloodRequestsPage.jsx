import React, { useEffect, useState } from "react";
import { db } from "../../firebase/config";
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { LuSearch, LuFilter, LuEye, LuArchive, LuTrash2, LuCheck } from "react-icons/lu";

const BloodRequestsPage = ({ onViewDetail }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("patientName");
  const [selectedBloodType, setSelectedBloodType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  
  const [banner, setBanner] = useState({ show: false, message: "" });

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    actionType: null, // 'archive' or 'delete'
    requestItem: null,
  });

  const bloodTypesList = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  useEffect(() => {
    async function fetchAllRequests() {
      try {
        setLoading(true);
        const q = query(collection(db, "blood_requests"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedRequests = querySnapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setRequests(fetchedRequests);
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAllRequests();
  }, []);

  const handleConfirmAction = async () => {
    const { actionType, requestItem } = confirmModal;
    if (!actionType || !requestItem) return;

    try {
      if (actionType === "archive") {
        const ref = doc(db, "blood_requests", requestItem.id);
        await updateDoc(ref, { status: "archived", updatedAt: serverTimestamp() });
        
        setRequests((prev) => prev.filter((r) => r.id !== requestItem.id));
        setBanner({ show: true, message: `Successfully archived request for ${requestItem.patientName || "Patient"}!` });
      } else if (actionType === "delete") {
        await deleteDoc(doc(db, "blood_requests", requestItem.id));
        setRequests((prev) => prev.filter((r) => r.id !== requestItem.id));
        setBanner({ show: true, message: "Successfully deleted blood request record." });
      }

      setTimeout(() => setBanner({ show: false, message: "" }), 4000);
      setConfirmModal({ isOpen: false, actionType: null, requestItem: null });
    } catch (err) {
      console.error(`Error during ${actionType}:`, err);
    }
  };

  const filteredRequests = requests.filter((req) => {
    const patientName = (req.patientName || "").toLowerCase();
    const bloodType = (req.bloodType || "").toLowerCase();
    const hospital = (req.hospital || "").toLowerCase();
    const status = (req.status || "pending").toLowerCase();
    const queryText = searchQuery.toLowerCase();

    // HIDE ARCHIVED ITEMS FROM THIS MAIN TABLE LIST
    if (status === "archived") return false;

    if (selectedStatus && status !== selectedStatus.toLowerCase()) return false;
    if (selectedBloodType && bloodType !== selectedBloodType.toLowerCase()) return false;

    if (filterCategory === "hospital") {
      return hospital.includes(queryText);
    } else {
      return patientName.includes(queryText);
    }
  });

  if (loading) {
    return <div className="p-6 text-gray-500 font-medium">Loading blood requests...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {banner.show && (
        <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold shadow-xs transition-all">
          <LuCheck size={18} className="text-emerald-600 shrink-0" />
          <span>{banner.message}</span>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-200 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Blood Requests Dashboard</h1>
          <p className="text-xs text-gray-500">Manage active requests, search by name or hospital</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 font-medium cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={selectedBloodType}
            onChange={(e) => setSelectedBloodType(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 font-medium cursor-pointer"
          >
            <option value="">All Blood Types</option>
            {bloodTypesList.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700">
            <LuFilter size={14} className="text-gray-400 shrink-0" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer font-medium text-gray-700 w-full"
            >
              <option value="patientName">Patient Name</option>
              <option value="hospital">Hospital</option>
            </select>
          </div>

          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <LuSearch size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search by ${filterCategory === "patientName" ? "name" : "hospital"}...`}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-800 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blood Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hospital</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-400">
                  No active blood requests found.
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => (
                <tr key={req.id} onClick={() => onViewDetail(req)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{req.patientName || "Unnamed"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2.5 py-1 bg-red-50 text-[#D32F2F] text-xs font-bold rounded-full border border-red-100">
                      {req.bloodType || "O+"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{req.component || "Whole Blood"}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{req.hospital || "N/A"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      req.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {req.status || "pending"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <div className="flex items-center justify-end gap-2 text-gray-400">
                      <button onClick={(e) => { e.stopPropagation(); onViewDetail(req); }} className="p-1.5 hover:text-blue-600 rounded-lg">
                        <LuEye size={17} />
                      </button>
                      <button 
                        title="Archive Request" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModal({ isOpen: true, actionType: "archive", requestItem: req });
                        }} 
                        className="p-1.5 hover:text-amber-600 rounded-lg"
                      >
                        <LuArchive size={17} />
                      </button>
                      <button 
                        title="Delete Request" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModal({ isOpen: true, actionType: "delete", requestItem: req });
                        }} 
                        className="p-1.5 hover:text-rose-600 rounded-lg"
                      >
                        <LuTrash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 capitalize">
              Confirm {confirmModal.actionType}
            </h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to <span className="font-semibold">{confirmModal.actionType}</span> the blood request for{" "}
              <span className="font-semibold text-gray-900">{confirmModal.requestItem?.patientName || "this patient"}</span>?
            </p>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setConfirmModal({ isOpen: false, actionType: null, requestItem: null })}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`flex-1 px-4 py-2.5 text-xs font-semibold text-white rounded-xl transition-colors shadow-xs ${
                  confirmModal.actionType === "delete"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                Yes, {confirmModal.actionType}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BloodRequestsPage;