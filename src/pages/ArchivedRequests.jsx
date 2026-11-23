import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { LuArchive, LuRotateCcw, LuCheck } from "react-icons/lu";
import { useAuth } from "../context/useAuth";
import { restoreRequest } from "../services/firestore/requestService";
import {
  RequestStatus,
  requestStatusClasses,
  requestStatusLabel,
} from "../constants/statuses";

const isLegacyArchive = (req) =>
  String(req.status || "").trim().toLowerCase() === RequestStatus.archived;

const ArchivedRequests = () => {
  const { currentUser } = useAuth();
  const [archivedList, setArchivedList] = useState([]);
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState({ show: false, message: "" });

  // Current archives use the admin-only flag; older ones overwrote the status.
  useEffect(() => {
    async function fetchArchivedRequests() {
      try {
        const requests = collection(db, "blood_requests");
        const [flagged, legacy] = await Promise.all([
          getDocs(query(requests, where("archived", "==", true))),
          getDocs(query(requests, where("status", "==", RequestStatus.archived))),
        ]);
        const byId = new Map();
        [...flagged.docs, ...legacy.docs].forEach((docItem) =>
          byId.set(docItem.id, { id: docItem.id, ...docItem.data() })
        );
        setArchivedList([...byId.values()]);
      } catch (error) {
        console.error("Error fetching archived requests:", error);
        setActionError("Could not load archived requests. Refresh to try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchArchivedRequests();
  }, []);

  // Clears the archive flag; legacy archives get their real status back.
  const handleRestore = async (req) => {
    setBusyId(req.id);
    setActionError("");
    const result = await restoreRequest(req.id, currentUser);
    setBusyId("");

    if (!result.success) {
      setActionError(result.error || "Could not restore the request.");
      return;
    }

    setArchivedList((prev) => prev.filter((item) => item.id !== req.id));
    const name = req.patientName || "this patient";
    setBanner({
      show: true,
      message: result.restoredStatus
        ? `Restored the request for ${name} as "${requestStatusLabel(result.restoredStatus)}".`
        : `Restored the request for ${name}.`,
    });
    setTimeout(() => setBanner({ show: false, message: "" }), 4000);
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

      {actionError && (
        <div role="alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold">
          {actionError}
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
                      {req.bloodType || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{req.hospitalName || req.hospital || "N/A"}</td>
                  <td className="px-6 py-4 text-sm">
                    {isLegacyArchive(req) ? (
                      <span
                        title="Archived by an older admin version, which overwrote the status. Restoring brings back the status donors last saw."
                        className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase bg-gray-100 text-gray-700"
                      >
                        Archived (legacy)
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${requestStatusClasses(req.status)}`}>
                        {requestStatusLabel(req.status)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => handleRestore(req)}
                      disabled={!!busyId}
                      className="disabled:opacity-50 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold rounded-xl transition-colors"
                    >
                      <LuRotateCcw size={14} /> {busyId === req.id ? "Restoring..." : "Restore"}
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