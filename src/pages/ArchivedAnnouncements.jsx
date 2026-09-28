import React, { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { LuArchive, LuRotateCcw, LuCheck, LuUsers, LuCalendar, LuEye } from "react-icons/lu";

export default function ArchivedAnnouncements() {
  const [archivedAnnouncements, setArchivedAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState({ show: false, message: "" });

  const fetchArchivedAnnouncements = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "announcements"), where("status", "==", "Archived"));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
      setArchivedAnnouncements(list);
    } catch (error) {
      console.error("Error fetching archived announcements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedAnnouncements();
  }, []);

  const handleRestore = async (id, title) => {
    try {
      const ref = doc(db, "announcements", id);
      await updateDoc(ref, {
        status: "Published",
        updatedAt: serverTimestamp(),
      });
      setArchivedAnnouncements((prev) => prev.filter((item) => item.id !== id));
      setBanner({ show: true, message: `Successfully restored advisory "${title}"!` });
      setTimeout(() => setBanner({ show: false, message: "" }), 4000);
    } catch (error) {
      console.error("Error restoring announcement:", error);
      alert(`Failed to restore: ${error.message}`);
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'Urgent':
        return <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">🔴 URGENT</span>;
      case 'Important':
        return <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">🟠 IMPORTANT</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">🔵 NORMAL</span>;
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading archived announcements...</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {banner.show && (
        <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold shadow-xs transition-all">
          <LuCheck size={18} className="text-emerald-600 shrink-0" />
          <span>{banner.message}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-50 border border-gray-200 text-gray-600 rounded-xl flex items-center justify-center shrink-0">
          <LuArchive size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Archived Announcements</h1>
          <p className="text-xs text-gray-500">View or restore previously archived advisories and broadcasts</p>
        </div>
      </div>

      {/* Feed Container */}
      {archivedAnnouncements.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-xs">
          <p className="text-sm font-semibold text-gray-400">No archived announcements found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {archivedAnnouncements.map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(item.priority || 'Normal')}
                    {item.category && (
                      <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">{item.title}</h3>
                </div>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase bg-gray-100 text-gray-600">
                  Archived
                </span>
              </div>

              <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{item.content}</p>

              <div className="flex flex-wrap items-center justify-between pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 font-medium text-gray-500">
                    <LuUsers size={13} /> {item.audience || 'All Users'}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-gray-500">
                    <LuCalendar size={13} /> {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-gray-500">
                    <LuEye size={13} /> {item.viewsCount || 0} views
                  </span>
                </div>

                <button
                  onClick={() => handleRestore(item.id, item.title)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold transition-colors border border-emerald-200/60 shadow-2xs"
                >
                  <LuRotateCcw size={14} /> Restore Advisory
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}