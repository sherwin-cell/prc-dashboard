import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { LuSearch, LuRotateCcw, LuTrash2, LuCheck, LuArrowLeft } from "react-icons/lu";

const ArchivedUsersPage = ({ onBack }) => {
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [banner, setBanner] = useState({ show: false, message: "" });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, actionType: null, user: null });

  useEffect(() => {
    async function fetchArchivedUsers() {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const userList = querySnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((user) => user.status === "archived");

        setArchivedUsers(userList);
      } catch (error) {
        console.error("Error fetching archived users:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchArchivedUsers();
  }, []);

  const handleConfirmAction = async () => {
    const { actionType, user } = confirmModal;
    if (!actionType || !user) return;

    try {
      if (actionType === 'restore') {
        await updateDoc(doc(db, 'users', user.id), { status: 'active', updatedAt: serverTimestamp() });
        setArchivedUsers(prev => prev.filter(u => u.id !== user.id));
        setBanner({ show: true, message: `Successfully restored user: ${user.fullname || user.email}` });
      } else if (actionType === 'delete') {
        await deleteDoc(doc(db, 'users', user.id));
        setArchivedUsers(prev => prev.filter(u => u.id !== user.id));
        setBanner({ show: true, message: `Permanently deleted user: ${user.fullname || user.email}` });
      }
      setTimeout(() => setBanner({ show: false, message: "" }), 4000);
      setConfirmModal({ isOpen: false, actionType: null, user: null });
    } catch (error) {
      console.error(`Error during ${actionType}:`, error);
      alert(`Failed to ${actionType} user.`);
    }
  };

  const filteredUsers = archivedUsers.filter((user) => {
    const name = (user.fullname || user.fullName || "").toLowerCase();
    const email = (user.email || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  if (loading) {
    return <div className="p-6 text-gray-500 font-medium">Loading archived users...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {banner.show && (
        <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold shadow-xs">
          <LuCheck size={18} className="text-emerald-600 shrink-0" />
          <span>{banner.message}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-xs border border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition"
            title="Back to Active Users"
          >
            <LuArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Archived Users</h1>
            <p className="text-xs text-gray-500">View, restore, or permanently remove deactivated accounts</p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
            <LuSearch size={16} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archived user..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-red-500 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-xs rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                <th className="p-4 pl-6">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Location</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-12 text-center text-sm font-semibold text-gray-400">
                    No archived users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 pl-6 font-semibold text-gray-950 whitespace-nowrap">
                      {user.fullname || user.fullName || "N/A"}
                    </td>
                    <td className="p-4 whitespace-nowrap">{user.email || "N/A"}</td>
                    <td className="p-4 whitespace-nowrap">{user.barangay}, {user.municipality}</td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          title="Restore User" 
                          onClick={() => setConfirmModal({ isOpen: true, actionType: 'restore', user })} 
                          className="p-1.5 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-gray-500 flex items-center gap-1 font-medium text-xs"
                        >
                          <LuRotateCcw size={16} /> Restore
                        </button>
                        <button 
                          title="Delete Permanently" 
                          onClick={() => setConfirmModal({ isOpen: true, actionType: 'delete', user })} 
                          className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-gray-500"
                        >
                          <LuTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 capitalize">Confirm {confirmModal.actionType}</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to <span className="font-semibold">{confirmModal.actionType}</span> the user account for{" "}
              <span className="font-semibold text-gray-900">{confirmModal.user?.fullname || confirmModal.user?.email}</span>?
            </p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setConfirmModal({ isOpen: false, actionType: null, user: null })} className="flex-1 px-4 py-2.5 text-xs font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmAction} className={`flex-1 px-4 py-2.5 text-xs font-semibold text-white rounded-xl transition-colors shadow-xs ${confirmModal.actionType === 'delete' ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                Yes, {confirmModal.actionType}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivedUsersPage;