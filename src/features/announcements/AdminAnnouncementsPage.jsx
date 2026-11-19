// import React, { useState, useEffect } from 'react';
// import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, deleteDoc, doc } from 'firebase/firestore';
// import { db } from '../../firebase/config';
// import { LuMegaphone, LuArchive, LuEye, LuCheck, LuTrash2, LuPencil, LuArrowLeft, LuSearch, LuFilter } from 'react-icons/lu';

// export default function AdminAnnouncementsPage() {
//   const [announcements, setAnnouncements] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [submitting, setSubmitting] = useState(false);
//   const [banner, setBanner] = useState({ show: false, message: '' });

//   // Navigation & View States
//   const [selectedAnnouncement, setSelectedAnnouncement] = useState(null); // For Eye View Detail
//   const [editingId, setEditingId] = useState(null); // For Edit mode

//   // Form States
//   const [title, setTitle] = useState('');
//   const [content, setContent] = useState('');
//   const [category, setCategory] = useState('');
//   const [audience, setAudience] = useState('All Users');
//   const [priority, setPriority] = useState('Normal');
//   const [isPreviewOpen, setIsPreviewOpen] = useState(false);

//   // Search & Filter States
//   const [searchQuery, setSearchQuery] = useState('');
//   const [filterCategory, setFilterCategory] = useState('title'); // 'title' or 'category'
//   const [selectedPriority, setSelectedPriority] = useState('');

//   // Custom Confirmation Modal State
//   const [confirmModal, setConfirmModal] = useState({
//     isOpen: false,
//     actionType: null, // 'archive' or 'delete'
//     item: null,
//   });

//   useEffect(() => {
//     const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
//     const unsubscribe = onSnapshot(q, (snapshot) => {
//       const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//       // Filter out archived ones on the main active list
//       setAnnouncements(list.filter(item => item.status !== 'Archived'));
//       setLoading(false);
//     });
//     return () => unsubscribe();
//   }, []);

//   const handleSaveAnnouncement = async (e) => {
//     e.preventDefault();
//     if (!title.trim() || !content.trim() || !category) return;

//     setSubmitting(true);
//     try {
//       if (editingId) {
//         // Update existing announcement
//         const ref = doc(db, 'announcements', editingId);
//         await updateDoc(ref, {
//           title: title.trim(),
//           content: content.trim(),
//           category,
//           audience,
//           priority,
//           updatedAt: serverTimestamp(),
//         });
//         setBanner({ show: true, message: 'Announcement updated successfully!' });
//         setEditingId(null);
//       } else {
//         // Create new announcement
//         await addDoc(collection(db, 'announcements'), {
//           title: title.trim(),
//           content: content.trim(),
//           category,
//           audience,
//           priority,
//           status: 'Published',
//           viewsCount: 0,
//           createdAt: serverTimestamp(),
//         });
//         setBanner({ show: true, message: 'Announcement published successfully!' });
//       }

//       setTitle('');
//       setContent('');
//       setCategory('');
//       setAudience('All Users');
//       setPriority('Normal');
//       setTimeout(() => setBanner({ show: false, message: '' }), 4000);
//     } catch (error) {
//       console.error("Error saving announcement:", error);
//       alert("Failed to save announcement.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleEditClick = (item) => {
//     setEditingId(item.id);
//     setTitle(item.title || '');
//     setContent(item.content || '');
//     setCategory(item.category || '');
//     setAudience(item.audience || 'All Users');
//     setPriority(item.priority || 'Normal');
//     window.scrollTo({ top: 0, behavior: 'smooth' });
//   };

//   const handleCancelEdit = () => {
//     setEditingId(null);
//     setTitle('');
//     setContent('');
//     setCategory('');
//     setAudience('All Users');
//     setPriority('Normal');
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

//   // Filter and Search Logic
//   const filteredAnnouncements = announcements.filter((item) => {
//     const itemTitle = (item.title || "").toLowerCase();
//     const itemCategory = (item.category || "").toLowerCase();
//     const itemPriority = (item.priority || "normal").toLowerCase();
//     const queryText = searchQuery.toLowerCase();

//     if (selectedPriority && itemPriority !== selectedPriority.toLowerCase()) return false;

//     if (filterCategory === "category") {
//       return itemCategory.includes(queryText);
//     } else {
//       return itemTitle.includes(queryText);
//     }
//   });

//   // Detailed View Render when Eye icon is clicked
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
//           <h1 className="text-lg font-bold text-gray-900">Manage Announcements</h1>
//           <p className="text-xs text-gray-500">Create, review, edit, and broadcast advisories or system updates</p>
//         </div>
//       </div>

//       {/* Create / Edit Form */}
//       <form onSubmit={handleSaveAnnouncement} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
//         <div className="flex justify-between items-center">
//           <div>
//             <h2 className="text-base font-bold text-gray-900">
//               {editingId ? "Edit Announcement" : "Broadcast New Advisory"}
//             </h2>
//             <p className="text-xs text-gray-500 mt-0.5">
//               {editingId ? "Modify existing broadcast parameters." : "Publish an advisory or important announcement to target user groups."}
//             </p>
//           </div>
//           {editingId && (
//             <button
//               type="button"
//               onClick={handleCancelEdit}
//               className="text-xs text-gray-500 hover:text-gray-700 underline font-semibold"
//             >
//               Cancel Edit
//             </button>
//           )}
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div>
//             <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
//             <select
//               value={category}
//               onChange={(e) => setCategory(e.target.value)}
//               className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-700 font-medium cursor-pointer focus:outline-none focus:border-red-500"
//               required
//             >
//               <option value="">Select Category</option>
//               <option value="Urgent Blood Need">🔴 Urgent Blood Need</option>
//               <option value="Blood Donation Drive">🩸 Blood Donation Drive</option>
//               <option value="Event">📅 Event</option>
//               <option value="Important Notice">📢 Important Notice</option>
//               <option value="System Update">📱 System Update</option>
//               <option value="Health Tips & Guidelines">💡 Health Tips & Guidelines</option>
//             </select>
//           </div>

//           <div>
//             <label className="block text-xs font-semibold text-gray-600 mb-1">Target Audience</label>
//             <select
//               value={audience}
//               onChange={(e) => setAudience(e.target.value)}
//               className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-700 font-medium cursor-pointer focus:outline-none focus:border-red-500"
//             >
//               <option value="All Users">All Users</option>
//               <option value="Donors">Donors</option>
//               <option value="Requesters">Requesters</option>
//               <option value="Verified Donors">Verified Donors</option>
//               <option value="PRC Users">PRC Users</option>
//             </select>
//           </div>
//         </div>

//         <div>
//           <label className="block text-xs font-semibold text-gray-600 mb-1">Announcement Title</label>
//           <input
//             type="text"
//             value={title}
//             onChange={(e) => setTitle(e.target.value)}
//             placeholder="e.g., Blood Donation Drive — October 10"
//             className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:outline-none focus:border-red-500"
//             required
//           />
//         </div>

//         <div>
//           <label className="block text-xs font-semibold text-gray-600 mb-1">Message Content</label>
//           <textarea
//             value={content}
//             onChange={(e) => setContent(e.target.value)}
//             placeholder="Type comprehensive announcement guidelines here..."
//             rows="4"
//             className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:outline-none focus:border-red-500"
//             required
//           />
//         </div>

//         <div>
//           <label className="block text-xs font-semibold text-gray-600 mb-2">Priority Level</label>
//           <div className="flex gap-6 text-xs font-medium text-gray-700">
//             {['Normal', 'Important', 'Urgent'].map((p) => (
//               <label key={p} className="flex items-center gap-2 cursor-pointer">
//                 <input
//                   type="radio"
//                   name="priority"
//                   value={p}
//                   checked={priority === p}
//                   onChange={(e) => setPriority(e.target.value)}
//                   className="text-[#D32F2F] focus:ring-red-500"
//                 />
//                 {p}
//               </label>
//             ))}
//           </div>
//         </div>

//         <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
//           <button
//             type="button"
//             onClick={() => setIsPreviewOpen(true)}
//             className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-2xs"
//           >
//             <LuEye size={15} /> Preview
//           </button>
//           <button
//             type="submit"
//             disabled={submitting}
//             className="bg-[#D32F2F] text-white px-5 py-2 rounded-xl text-xs font-semibold hover:bg-red-700 transition-colors shadow-xs disabled:opacity-50"
//           >
//             {submitting ? 'Saving...' : editingId ? 'Update Announcement' : 'Publish Announcement'}
//           </button>
//         </div>
//       </form>

//       {/* Search and Filters Card for Table */}
//       <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-200 space-y-4">
//         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
//           <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Published Announcements List</h2>
//           <span className="text-xs text-gray-500">Showing active broadcasted records</span>
//         </div>

//         <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
//           {/* Priority Filter */}
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

//           {/* Filter Category Select */}
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

//           {/* Search Input */}
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

//       {/* Announcements Table View */}
//       <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
//         {loading ? (
//           <p className="text-gray-500 text-center py-12 text-xs">Loading announcements...</p>
//         ) : filteredAnnouncements.length === 0 ? (
//           <div className="p-12 text-center text-sm font-semibold text-gray-500">
//             No active announcements found matching your criteria.
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
//                           onClick={() => handleEditClick(item)}
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

//       {/* Live Preview Modal */}
//       {isPreviewOpen && (
//         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
//           <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100">
//             <div className="flex items-center justify-between border-b pb-3">
//               <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">User Feed Preview</span>
//               <button 
//                 onClick={() => setIsPreviewOpen(false)}
//                 className="text-gray-400 hover:text-gray-600 font-bold text-sm"
//               >
//                 ✕
//               </button>
//             </div>

//             <div className="bg-red-50/40 border border-red-100 rounded-2xl p-5 space-y-3">
//               <div className="flex items-center gap-2">
//                 {getPriorityBadge(priority)}
//                 <span className="text-[10px] font-bold text-gray-500">{category || 'Category'}</span>
//               </div>
//               <h3 className="font-bold text-gray-900 text-base">{title || 'Announcement Title'}</h3>
//               <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
//                 {content || 'Announcement content will appear here...'}
//               </p>
//               <div className="pt-2 border-t border-red-100 flex justify-between items-center text-[10px] text-gray-400 font-semibold">
//                 <span>Target: {audience}</span>
//                 <span className="text-[#D32F2F]">Philippine Red Cross</span>
//               </div>
//             </div>

//             <button
//               onClick={() => setIsPreviewOpen(false)}
//               className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-gray-800 transition-colors"
//             >
//               Close Preview
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Custom Confirmation Modal */}
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