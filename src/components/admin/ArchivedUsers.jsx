import React, { useEffect, useState } from "react";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { LuRotateCcw, LuTrash2, LuArchive } from "react-icons/lu";

const ArchivedUsers = () => {
  const [archivedList, setArchivedList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch archived items
  const fetchArchived = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "users"), where("status", "==", "archived"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setArchivedList(data);
    } catch (error) {
      console.error("Error fetching archived items:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchived();
  }, []);

  // Handle Unarchive action
  const handleRestore = async (id) => {
    try {
      const docRef = doc(db, "users", id);
      await updateDoc(docRef, { status: "active" }); // or whatever your default status is
      setArchivedList((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Error restoring item:", error);
    }
  };

  if (loading) return <p className="p-6 text-xs text-gray-500">Loading archived records...</p>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="border-b pb-4 flex items-center gap-2">
        <LuArchive className="text-gray-600" size={22} />
        <h1 className="text-xl font-bold text-gray-900">Archived Records</h1>
      </div>

      {archivedList.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-500">
          No archived records found.
        </div>
      ) : (
        <div className="space-y-3">
          {archivedList.map((user) => (
            <div key={user.id} className="bg-white p-4 rounded-2xl border border-gray-200 flex items-center justify-between shadow-xs">
              <div>
                <h3 className="font-bold text-sm text-gray-900">{user.name || user.email || "Unnamed"}</h3>
                <p className="text-xs text-gray-400">Archived on: {user.archivedAt?.seconds ? new Date(user.archivedAt.seconds * 1000).toLocaleDateString() : "Recently"}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRestore(user.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition"
                >
                  <LuRotateCcw size={14} /> Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArchivedUsers;