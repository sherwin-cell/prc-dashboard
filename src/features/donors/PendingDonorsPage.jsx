import React, { useState, useEffect } from 'react';
import { subscribeToPendingDonors, updateDonorStatus } from '../../services/firestore/donorService';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function PendingDonorsPage() {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToPendingDonors(
      (data) => {
        setDonors(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Failed to load pending donor applications.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleAction = async (userId, newStatus) => {
    const actionText = newStatus === 'approved' ? 'approve' : 'reject';
    if (!window.confirm(`Are you sure you want to ${actionText} this donor application?`)) return;

    const result = await updateDonorStatus(userId, newStatus, currentUser);
    if (!result.success) {
      alert(`Error: ${result.error}`);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Pending Donor Applications</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      {donors.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500 font-medium">No pending donor applications to review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {donors.map((donor) => (
            <div key={donor.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{donor.fullName || 'User'}</h3>
                  <span className="px-3 py-1 bg-red-100 text-red-800 font-bold text-sm rounded-full">
                    {donor.bloodType || 'N/A'}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-6">
                  <p><strong className="text-gray-700">Email:</strong> {donor.email}</p>
                  <p><strong className="text-gray-700">Chapter:</strong> {donor.chapter || 'N/A'}</p>
                  <p><strong className="text-gray-700">Available:</strong> {donor.isAvailableForDonation ? 'Yes' : 'No'}</p>
                  <p><strong className="text-gray-700">Last Donation:</strong> {donor.lastDonationDate ? new Date(donor.lastDonationDate.seconds * 1000).toLocaleDateString() : 'None / Never'}</p>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleAction(donor.id, 'rejected')}
                  className="flex-1 px-4 py-2 border border-red-300 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction(donor.id, 'approved')}
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