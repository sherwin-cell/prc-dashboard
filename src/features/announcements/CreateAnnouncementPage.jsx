import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LuMegaphone, LuEye, LuCheck } from 'react-icons/lu';

export default function CreateAnnouncementPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [audience, setAudience] = useState('All Users');
  const [priority, setPriority] = useState('Normal');
  const [submitting, setSubmitting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [banner, setBanner] = useState({ show: false, message: '' });

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !category) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: title.trim(),
        content: content.trim(),
        category,
        audience,
        priority,
        status: 'Published',
        viewsCount: 0,
        createdAt: serverTimestamp(),
      });

      setTitle('');
      setContent('');
      setCategory('');
      setAudience('All Users');
      setPriority('Normal');
      setBanner({ show: true, message: 'Announcement published successfully!' });
      setTimeout(() => setBanner({ show: false, message: '' }), 4000);
    } catch (error) {
      console.error("Error publishing announcement:", error);
      alert("Failed to publish announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'Urgent':
        return <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">🔴 URGENT</span>;
      case 'Important':
        return <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">🟠 IMPORTANT</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">🔵 NORMAL</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {banner.show && (
        <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold shadow-xs transition-all">
          <LuCheck size={18} className="text-emerald-600 shrink-0" />
          <span>{banner.message}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
        <div className="w-12 h-12 bg-red-50 border border-red-100 text-[#D32F2F] rounded-xl flex items-center justify-center shrink-0">
          <LuMegaphone size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Broadcast New Advisory</h1>
          <p className="text-xs text-gray-500">Publish urgent notices, blood donation drives, or system announcements</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handlePostAnnouncement} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-700 font-medium cursor-pointer focus:outline-none focus:border-red-500"
              required
            >
              <option value="">Select Category</option>
              <option value="Urgent Blood Need">🔴 Urgent Blood Need</option>
              <option value="Blood Donation Drive">🩸 Blood Donation Drive</option>
              <option value="Event">📅 Event</option>
              <option value="Important Notice">📢 Important Notice</option>
              <option value="System Update">📱 System Update</option>
              <option value="Health Tips & Guidelines">💡 Health Tips & Guidelines</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Target Audience</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-700 font-medium cursor-pointer focus:outline-none focus:border-red-500"
            >
              <option value="All Users">All Users</option>
              <option value="Donors">Donors</option>
              <option value="Requesters">Requesters</option>
              <option value="Verified Donors">Verified Donors</option>
              <option value="PRC Users">PRC Users</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Announcement Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Blood Donation Drive — October 10"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:outline-none focus:border-red-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Message Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type comprehensive announcement guidelines here..."
            rows="5"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:outline-none focus:border-red-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Priority Level</label>
          <div className="flex gap-6 text-xs font-medium text-gray-700">
            {['Normal', 'Important', 'Urgent'].map((p) => (
              <label key={p} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value={p}
                  checked={priority === p}
                  onChange={(e) => setPriority(e.target.value)}
                  className="text-[#D32F2F] focus:ring-red-500"
                />
                {p}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <LuEye size={15} /> Preview
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#D32F2F] text-white px-5 py-2 rounded-xl text-xs font-semibold hover:bg-red-700 transition-colors shadow-xs disabled:opacity-50"
          >
            {submitting ? 'Publishing...' : 'Publish Announcement'}
          </button>
        </div>
      </form>

      {/* Live Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">User Feed Preview</span>
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-red-50/40 border border-red-100 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                {getPriorityBadge(priority)}
                <span className="text-[10px] font-bold text-gray-500">{category || 'Category'}</span>
              </div>
              <h3 className="font-bold text-gray-900 text-base">{title || 'Announcement Title'}</h3>
              <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                {content || 'Announcement content will appear here...'}
              </p>
              <div className="pt-2 border-t border-red-100 flex justify-between items-center text-[10px] text-gray-400 font-semibold">
                <span>Target: {audience}</span>
                <span className="text-[#D32F2F]">Philippine Red Cross</span>
              </div>
            </div>

            <button
              onClick={() => setIsPreviewOpen(false)}
              className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-gray-800 transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}