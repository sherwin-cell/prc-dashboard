import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getVerificationRequests } from "../../services/firestore/verificationService";

const VerificationListPage = () => {
  const [filter, setFilter] = useState("PENDING");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVerifications() {
      setLoading(true);
      try {
        // Fetch directly using your service function targeting the 'users' collection
        const list = await getVerificationRequests(filter);
        setRequests(list);
      } catch (error) {
        console.error("Error fetching verifications:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchVerifications();
  }, [filter]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Donor Verifications</h1>
      <p className="text-sm text-gray-500 mb-6">Review government IDs and facial verification submissions.</p>

      <div className="flex gap-2 mb-6">
        {["PENDING", "APPROVED", "REJECTED"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              filter === tab
                ? "bg-[#D32F2F] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No verification requests found for {filter.toLowerCase()}.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((req) => (
                <tr key={req.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {req.userName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase font-semibold">
                    {req.status}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link to={`/verifications/${req.userId}`} className="text-[#D32F2F] hover:underline">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default VerificationListPage;