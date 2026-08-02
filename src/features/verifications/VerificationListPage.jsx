import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// Updated Service Import
import { getVerificationRequests } from "../../services/firestore/verificationService";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { LuSearch, LuEye, LuRefreshCw } from "react-icons/lu";

const VerificationListPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getVerificationRequests(filter);
      setRequests(data);
    } catch (err) {
      console.error("Failed to load verification requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  const filteredRequests = requests.filter((req) => {
    const search = searchQuery.toLowerCase();
    return (
      req.userName?.toLowerCase().includes(search) ||
      req.userEmail?.toLowerCase().includes(search) ||
      req.idType?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Donor Verifications</h2>
          <p className="text-sm text-gray-500">
            Review government IDs, OCR scans, and facial verification matches.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          <LuRefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Status Filter Tabs */}
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {["PENDING", "APPROVED", "REJECTED", "ALL"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                filter === status
                  ? "bg-[#D32F2F] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <LuSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 text-sm rounded-lg focus:ring-2 focus:ring-[#D32F2F] focus:outline-hidden"
          />
        </div>
      </div>

      {/* Verification Data Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Fetching donor verifications..." />
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="font-semibold text-lg">No verification requests found</p>
            <p className="text-sm">There are no records matching the selected filter or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-3">Applicant</th>
                  <th className="px-6 py-3">ID Type</th>
                  <th className="px-6 py-3">OCR Status</th>
                  <th className="px-6 py-3">Face Match</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{req.userName || "Unnamed User"}</div>
                      <div className="text-xs text-gray-500">{req.userEmail}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">
                      {req.idType || "Philippine Gov ID"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                        {req.ocrName ? "Extracted" : "Manual Check"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                          req.faceMatchConfidence >= 80
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {req.faceMatchConfidence ? `${req.faceMatchConfidence}% Match` : "Not Scanned"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/verifications/${req.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D32F2F] text-white text-xs font-medium rounded-lg hover:bg-[#B71C1C] transition-colors"
                      >
                        <LuEye size={14} />
                        <span>Review</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationListPage;