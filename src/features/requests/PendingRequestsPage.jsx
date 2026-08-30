import React, { useState, useEffect } from 'react';
import { subscribeToPendingRequests, updateRequestStatus } from '../../services/firestore/requestService';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';

export default function PendingRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToPendingRequests(
      (data) => {
        setRequests(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Failed to load pending requests.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleAction = async (requestId, newStatus) => {
    const actionText = newStatus === 'active' ? 'approve and publish' : 'reject';
    if (!window.confirm(`Are you sure you want to ${actionText} this blood request?`)) return;

    const result = await updateRequestStatus(requestId, newStatus, currentUser?.uid);
    if (!result.success) {
      alert(`Error: ${result.error}`);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Pending Blood Requests Review</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      {requests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500 font-medium">No pending blood requests to review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{req.patientName}</h3>
                  <span className="px-3 py-1 bg-red-100 text-red-800 font-bold text-sm rounded-full">
                    {req.bloodType}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-6">
                  <p><strong className="text-gray-700">Hospital:</strong> {req.hospitalLocation}</p>
                  <p><strong className="text-gray-700">Units Required:</strong> {req.unitsRequired}</p>
                  <p><strong className="text-gray-700">Urgency:</strong> <span className="capitalize">{req.urgency}</span></p>
                  <p><strong className="text-gray-700">Contact:</strong> {req.contactPerson} ({req.contactNumber})</p>
                  {req.notes && <p><strong className="text-gray-700">Notes:</strong> {req.notes}</p>}
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleAction(req.id, 'rejected')}
                  className="flex-1 px-4 py-2 border border-red-300 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction(req.id, 'active')}
                  className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}