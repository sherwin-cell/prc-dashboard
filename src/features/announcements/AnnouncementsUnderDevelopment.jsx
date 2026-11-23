import { Link } from 'react-router-dom';
import { LuMegaphone, LuConstruction } from 'react-icons/lu';

/**
 * Placeholder for Announcements (Item 14), which is still under development.
 * The original pages are kept, commented out, in this folder for when the
 * feature is built.
 */
export default function AnnouncementsUnderDevelopment() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-5">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 text-[#D32F2F] flex items-center justify-center">
        <LuMegaphone size={32} />
      </div>
      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
        <LuConstruction size={14} /> Under development
      </span>
      <h1 className="text-2xl font-black text-gray-900">Announcements</h1>
      <p className="text-sm text-gray-500">
        Publishing advisories to Blood-Connect users is not available yet.
        This page will let PRC create, publish and archive announcements once
        the feature is finished.
      </p>
      <Link
        to="/"
        className="inline-block px-4 py-2.5 bg-[#D32F2F] hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
