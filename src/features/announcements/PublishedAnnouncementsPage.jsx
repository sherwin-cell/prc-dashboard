// import React, { useState, useEffect } from 'react';
// import { collection, query, orderBy, onSnapshot, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
// import { db } from '../../firebase/config';
// import { LuMegaphone, LuArchive, LuEye, LuCheck, LuTrash2, LuPencil, LuArrowLeft, LuSearch, LuFilter } from 'react-icons/lu';

// export default function PublishedAnnouncementsPage() {
//   const [announcements, setAnnouncements] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedAnnouncement, setSelectedAnnouncement] = useState(null); // For Eye Details
//   const [editingItem, setEditingItem] = useState(null); // For Inline/Modal Edit
//   const [banner, setBanner] = useState({ show: false, message: '' });

//   // Search & Filter States
//   const [searchQuery, setSearchQuery] = useState('');
//   const [filterCategory, setFilterCategory] = useState('title');
//   const [selectedPriority, setSelectedPriority] = useState('');

//   // Confirmation Modal State
//   const [confirmModal, setConfirmModal] = useState({
//     isOpen: false,
//     actionType: null, // 'archive' or 'delete'
//     item: null,
//   });

//   useEffect(() => {
//     const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
//     const unsubscribe = onSnapshot(q, (snapshot) => {
//       const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//       setAnnouncements(list.filter(item => item.status !== 'Archived'));
//       setLoading(false);
//     });
//     return () => unsubscribe();
//   }, []);

//   const handleUpdateEdit = async (e) => {
//     e.preventDefault();
//     if (!editingItem) return;

//     try {
//       const ref = doc(db, 'announcements', editingItem.id);
//       await updateDoc(ref, {
//         title: editingItem.title.trim(),
//         content: editingItem.content.trim(),
//         category: editingItem.category,
//         audience: editingItem.audience,
//         priority: editingItem.priority,
//         updatedAt: serverTimestamp(),
//       });
//       setBanner({ show: true, message: 'Announcement updated successfully!' });
//       setEditingItem(null);
//       setTimeout(() => setBanner({ show: false, message: '' }), 4000);
//     } catch (error) {
//       console.error("Error updating announcement:", error);
//       alert("Failed to update announcement.");
//     }
//   };

//   const handleConfirmAction = async () => {
//     const { actionType, item } = confirmModal;
//     if (!actionType || !item) return;

//     try {
//       if (actionType === 'archive') {
//         const ref = doc(db, 'announcements', item.id);
//         await updateDoc(ref, { status: 'Archived', updatedAt: serverTimestamp() });
//         setBanner({ show: true, message: `Archived "${item.title}" successfully!` });
//       } else if (actionType === 'delete') {
//         await deleteDoc(doc(db, 'announcements', item.id));
//         setBanner({ show: true, message: `Permanently deleted "${item.title}".` });
//       }

//       setTimeout(() => setBanner({ show: false, message: '' }), 4000);
//       setConfirmModal({ isOpen: false, actionType: null, item: null });
//     } catch (error) {
//       console.error(`Error during ${actionType}:`, error);
//       alert(`Failed to ${actionType} announcement: ${error.message}`);
//     }
//   };

//   const getPriorityBadge = (p) => {
//     switch (p) {
//       case 'Urgent':
//         return <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">🔴 URGENT</span>;
//       case 'Important':
//         return <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">🟠 IMPORTANT</span>;
//       default:
//         return <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">🔵 NORMAL</span>;
//     }
//   };

//   const filteredAnnouncements = announcements.filter((item) => {
//     const itemTitle = (item.title || "").toLowerCase();
//     const itemCategory = (item.category || "").toLowerCase();
//     const itemPriority = (item.priority || "normal").toLowerCase();
//     const queryText = searchQuery.toLowerCase();

//     if (selectedPriority && itemPriority !== selectedPriority.toLowerCase()) return false;
//     if (filterCategory === "category") return itemCategory.includes(queryText);
//     return itemTitle.includes(queryText);
//   });

//   // Detailed View Render when Eye is clicked
//   if (selectedAnnouncement) {
//     return (
//       <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
//         <div className="flex items-center gap-3 border-b pb-4">
//           <button
//             onClick={() => setSelectedAnnouncement(null)}
//             className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition"
//             title="Back to List"
//           >
//             <LuArrowLeft size={20} />
//           </button>
//           <div>
//             <h1 className="text-xl font-bold text-gray-900">Announcement Details</h1>
//             <p className="text-xs text-gray-500">Comprehensive overview of advisory broadcast record</p>
//           </div>
//         </div>

//         <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
//           <div className="flex justify-between items-start">
//             <div className="space-y-1.5">
//               <div className="flex items-center gap-2">
//                 {getPriorityBadge(selectedAnnouncement.priority)}
//                 <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
//                   {selectedAnnouncement.category}
//                 </span>
//               </div>
//               <h3 className="font-bold text-lg text-gray-900">{selectedAnnouncement.title}</h3>
//             </div>
//             <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-extrabold rounded-full border border-emerald-100 uppercase">
//               {selectedAnnouncement.status || "Published"}
//             </span>
//           </div>

//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
//             <div>
//               <strong className="text-gray-700 block mb-0.5">Target Audience:</strong>
//               <span className="text-gray-900 font-medium">{selectedAnnouncement.audience || "All Users"}</span>
//             </div>
//             <div>
//               <strong className="text-gray-700 block mb-0.5">Published Date:</strong>
//               <span className="text-gray-900 font-medium">
//                 {selectedAnnouncement.createdAt?.seconds 
//                   ? new Date(selectedAnnouncement.createdAt.seconds * 1000).toLocaleDateString() 
//                   : "Just now"}
//               </span>
//             </div>
//             <div>
//               <strong className="text-gray-700 block mb-0.5">Total Views:</strong>
//               <span className="text-gray-900 font-medium">{selectedAnnouncement.viewsCount || 0} views</span>
//             </div>
//           </div>

//           <div className="space-y-2">
//             <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Message Content</h4>
//             <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-4 text-xs text-gray-800 whitespace-pre-line leading-relaxed">
//               {selectedAnnouncement.content}
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-6 max-w-7xl mx-auto p-6">
//       {banner.show && (
//         <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold shadow-xs transition-all">
//           <LuCheck size={18} className="text-emerald-600 shrink-0" />
//           <span>{banner.message}</span>
//         </div>
//       )}

//       {/* Top Header Card */}
//       <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
//         <div className="w-12 h-12 bg-red-50 border border-red-100 text-[#D32F2F] rounded-xl flex items-center justify-center shrink-0">
//           <LuMegaphone size={22} />
//         </div>
//         <div>
//           <h1 className="text-lg font-bold text-gray-900">Published Announcements</h1>
//           <p className="text-xs text-gray-500">Manage, inspect, edit, or archive active broadcasts</p>
//         </div>
//       </div>

//       {/* Search and Filters Card */}
//       <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-200 space-y-4">
//         <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
//           <select
//             value={selectedPriority}
//             onChange={(e) => setSelectedPriority(e.target.value)}
//             className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 font-medium cursor-pointer"
//           >
//             <option value="">All Priorities</option>
//             <option value="Normal">Normal</option>
//             <option value="Important">Important</option>
//             <option value="Urgent">Urgent</option>
//           </select>

//           <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700">
//             <LuFilter size={14} className="text-gray-400 shrink-0" />
//             <select
//               value={filterCategory}
//               onChange={(e) => setFilterCategory(e.target.value)}
//               className="bg-transparent focus:outline-none cursor-pointer font-medium text-gray-700 w-full"
//             >
//               <option value="title">Announcement Title</option>
//               <option value="category">Category</option>
//             </select>
//           </div>

//           <div className="relative w-full">
//             <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
//               <LuSearch size={16} />
//             </span>
//             <input
//               type="text"
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               placeholder={`Search by ${filterCategory}...`}
//               className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-800 focus:outline-none"
//             />
//           </div>
//         </div>
//       </div>

//       {/* Announcements Table */}
//       <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
//         {loading ? (
//           <p className="text-gray-500 text-center py-12 text-xs">Loading announcements...</p>
//         ) : filteredAnnouncements.length === 0 ? (
//           <div className="p-12 text-center text-sm font-semibold text-gray-500">
//             No active announcements found.
//           </div>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full text-left border-collapse">
//               <thead>
//                 <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
//                   <th className="p-4 pl-6">Title & Category</th>
//                   <th className="p-4">Priority</th>
//                   <th className="p-4">Audience</th>
//                   <th className="p-4">Views</th>
//                   <th className="p-4">Status</th>
//                   <th className="p-4 pr-6 text-right">Actions</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
//                 {filteredAnnouncements.map((item) => (
//                   <tr 
//                     key={item.id} 
//                     onClick={() => setSelectedAnnouncement(item)}
//                     className="hover:bg-gray-50/80 transition-colors cursor-pointer"
//                   >
//                     <td className="p-4 pl-6 font-semibold text-gray-900 max-w-xs truncate">
//                       {item.title}
//                       <span className="block font-normal text-[11px] text-gray-400">{item.category || "General"}</span>
//                     </td>
//                     <td className="p-4">{getPriorityBadge(item.priority)}</td>
//                     <td className="p-4 font-medium text-gray-700">{item.audience || "All Users"}</td>
//                     <td className="p-4 font-medium text-gray-500">{item.viewsCount || 0} views</td>
//                     <td className="p-4">
//                       <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-full">
//                         Published
//                       </span>
//                     </td>
//                     <td className="p-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
//                       <div className="flex items-center justify-end gap-1.5">
//                         <button
//                           title="View Details"
//                           onClick={() => setSelectedAnnouncement(item)}
//                           className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-gray-500"
//                         >
//                           <LuEye size={17} />
//                         </button>
//                         <button
//                           title="Edit Announcement"
//                           onClick={() => setEditingItem(item)}
//                           className="p-1.5 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors text-gray-500"
//                         >
//                           <LuPencil size={17} />
//                         </button>
//                         <button
//                           title="Archive Announcement"
//                           onClick={() => setConfirmModal({ isOpen: true, actionType: 'archive', item })}
//                           className="p-1.5 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
//                         >
//                           <LuArchive size={17} />
//                         </button>
//                         <button
//                           title="Delete Permanently"
//                           onClick={() => setConfirmModal({ isOpen: true, actionType: 'delete', item })}
//                           className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-gray-500"
//                         >
//                           <LuTrash2 size={17} />
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>

//       {/* Edit Modal */}
//       {editingItem && (
//         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
//           <form onSubmit={handleUpdateEdit} className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
//             <div className="flex justify-between items-center border-b pb-3">
//               <h3 className="text-base font-bold text-gray-900">Edit Announcement</h3>
//               <button type="button" onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
//             </div>
//             <div className="space-y-3">
//               <div>
//                 <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
//                 <input
//                   type="text"
//                   value={editingItem.title}
//                   onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
//                   className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs"
//                   required
//                 />
//               </div>
//               <div>
//                 <label className="block text-xs font-semibold text-gray-600 mb-1">Content</label>
//                 <textarea
//                   value={editingItem.content}
//                   onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
//                   rows="4"
//                   className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs"
//                   required
//                 />
//               </div>
//             </div>
//             <div className="flex gap-3 pt-4 border-t">
//               <button
//                 type="button"
//                 onClick={() => setEditingItem(null)}
//                 className="flex-1 px-4 py-2.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50"
//               >
//                 Cancel
//               </button>
//               <button
//                 type="submit"
//                 className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-[#D32F2F] hover:bg-red-700 rounded-xl"
//               >
//                 Save Changes
//               </button>
//             </div>
//           </form>
//         </div>
//       )}

//       {/* Confirmation Modal */}
//       {confirmModal.isOpen && (
//         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
//           <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
//             <h3 className="text-lg font-bold text-gray-900 capitalize">
//               Confirm {confirmModal.actionType}
//             </h3>
//             <p className="text-sm text-gray-600">
//               Are you sure you want to <span className="font-semibold">{confirmModal.actionType}</span> the announcement record for{" "}
//               <span className="font-semibold text-gray-900">{confirmModal.item?.title}</span>?
//             </p>
//             <div className="flex gap-3 pt-4">
//               <button
//                 onClick={() => setConfirmModal({ isOpen: false, actionType: null, item: null })}
//                 className="flex-1 px-4 py-2.5 text-xs font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleConfirmAction}
//                 className={`flex-1 px-4 py-2.5 text-xs font-semibold text-white rounded-xl transition-colors shadow-xs ${
//                   confirmModal.actionType === 'delete'
//                     ? "bg-rose-600 hover:bg-rose-700"
//                     : "bg-gray-900 hover:bg-gray-800"
//                 }`}
//               >
//                 Yes, {confirmModal.actionType}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }