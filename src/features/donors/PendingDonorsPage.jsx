import React, { useState, useEffect } from 'react';
import { subscribeToPendingDonors, updateDonorStatus } from '../../services/firestore/donorService';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import DonorDetail from './DonorDetail';
import { LuEye, LuArchive, LuTrash2, LuSearch, LuFilter } from 'react-icons/lu';
import { db } from '../../firebase/config';
import { doc, deleteDoc } from 'firebase/firestore';

export default function PendingDonorsPage() {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDonor, setSelectedDonor] = useState(null);
  const { currentUser } = useAuth();

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('donorName'); // 'donorName' or 'chapter'
  const [selectedBloodType, setSelectedBloodType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const bloodTypesList = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    actionType: null, // 'archive' or 'delete'
    donorId: null,
    donorName: '',
  });

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

  const handleConfirmAction = async () => {
    const { actionType, donorId } = confirmModal;
    if (!actionType || !donorId) return;

    try {
      if (actionType === 'archive') {
        await updateDonorStatus(donorId, 'archived', currentUser);
      } else if (actionType === 'delete') {
        await deleteDoc(doc(db, "donors", donorId));
      }

      setDonors((prev) => prev.filter((d) => d.id !== donorId));
      setConfirmModal({ isOpen: false, actionType: null, donorId: null, donorName: '' });
    } catch (err) {
      console.error(`${actionType} failed:`, err);
      alert(`Failed to ${actionType} application: ${err.message}`);
    }
  };

  // Filter and Search Logic
  const filteredDonors = donors.filter((donor) => {
    const donorName = (donor.fullName || donor.displayName || "").toLowerCase();
    const chapter = (donor.chapter || "").toLowerCase();
    const bloodType = (donor.bloodType || "").toLowerCase();
    const donorStatus = (donor.donorStatus || donor.status || "pending").toLowerCase();
    const queryText = searchQuery.toLowerCase();

    // Hide archived items from this view list
    if (donorStatus === "archived") return false;

    if (selectedStatus && donorStatus !== selectedStatus.toLowerCase()) return false;
    if (selectedBloodType && bloodType !== selectedBloodType.toLowerCase()) return false;

    if (filterCategory === "chapter") {
      return chapter.includes(queryText);
    } else {
      return donorName.includes(queryText);
    }
  });

  if (loading) return <LoadingSpinner />;

  if (selectedDonor) {
    return <DonorDetail donor={selectedDonor} onBack={() => setSelectedDonor(null)} />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Search & Filter Header Card */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-200 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pending Donor Applications</h1>
          <p className="text-xs text-gray-500">Review screening questions, IDs, and manage donor status</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Status Filter */}
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

          {/* Blood Type Filter */}
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

          {/* Filter Category Select */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700">
            <LuFilter size={14} className="text-gray-400 shrink-0" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer font-medium text-gray-700 w-full"
            >
              <option value="donorName">Donor Name</option>
              <option value="chapter">Chapter</option>
            </select>
          </div>

          {/* Search Query Input */}
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
              <LuSearch size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search by ${filterCategory === "donorName" ? "name" : "chapter"}...`}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-800 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-700 rounded-xl text-xs">{error}</div>}

      {/* Donors Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {filteredDonors.length === 0 ? (
          <div className="p-12 text-center text-sm font-semibold text-gray-500">
            No donor applications found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                  <th className="p-4">Donor Name</th>
                  <th className="p-4">Blood Type</th>
                  <th className="p-4">Chapter</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Last Donation</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {filteredDonors.map((donor) => {
                  const donorName = donor.fullName || donor.displayName || "Anonymous User";
                  const donorStatus = donor.donorStatus || donor.status || "pending";
                  return (
                    <tr key={donor.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 font-semibold text-gray-900">
                        {donorName}
                        <span className="block font-normal text-[11px] text-gray-400">{donor.email}</span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-red-50 text-[#D32F2F] font-extrabold rounded-full border border-red-100">
                          {donor.bloodType || "N/A"}
                        </span>
                      </td>
                      <td className="p-4">{donor.chapter || "N/A"}</td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          donorStatus === "approved" 
                            ? "bg-emerald-100 text-emerald-800" 
                            : donorStatus === "rejected"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {donorStatus}
                        </span>
                      </td>
                      <td className="p-4">
                        {donor.lastDonationDate 
                          ? new Date(donor.lastDonationDate.seconds ? donor.lastDonationDate.seconds * 1000 : donor.lastDonationDate).toLocaleDateString() 
                          : "Never"}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="View Details"
                            onClick={() => setSelectedDonor(donor)}
                            className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-gray-500"
                          >
                            <LuEye size={17} />
                          </button>
                          <button
                            title="Archive Application"
                            onClick={() => setConfirmModal({
                              isOpen: true,
                              actionType: 'archive',
                              donorId: donor.id,
                              donorName: donorName
                            })}
                            className="p-1.5 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors text-gray-500"
                          >
                            <LuArchive size={17} />
                          </button>
                          <button
                            title="Delete Application"
                            onClick={() => setConfirmModal({
                              isOpen: true,
                              actionType: 'delete',
                              donorId: donor.id,
                              donorName: donorName
                            })}
                            className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-gray-500"
                          >
                            <LuTrash2 size={17} />
                          </button>
                        </div>
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
            <h3 className="text-lg font-bold text-gray-900 capitalize">
              Confirm {confirmModal.actionType}
            </h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to <span className="font-semibold">{confirmModal.actionType}</span> the application for{" "}
              <span className="font-semibold text-gray-900">{confirmModal.donorName}</span>?
            </p>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setConfirmModal({ isOpen: false, actionType: null, donorId: null, donorName: '' })}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`flex-1 px-4 py-2.5 text-xs font-semibold text-white rounded-xl transition-colors shadow-xs ${
                  confirmModal.actionType === 'delete'
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
}