import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { 
  LuShieldCheck, 
  LuUsers, 
  LuDroplet, 
  LuMegaphone, 
  LuArrowRight, 
  LuClock, 
  LuCheck 
} from 'react-icons/lu';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    pendingDonors: 0,
    activeRequests: 0,
    publishedAnnouncements: 0,
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch pending donors count
        const donorsSnapshot = await getDocs(query(collection(db, "donors")));
        const pendingDonorsCount = donorsSnapshot.docs.filter(doc => {
          const data = doc.data();
          const status = data.donorStatus || data.status || "pending";
          return status === "pending";
        }).length;

        // Fetch active blood requests
        const requestsSnapshot = await getDocs(collection(db, "blood_requests"));
        const activeRequestsList = requestsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(req => (req.status || "pending").toLowerCase() !== "archived");

        // Fetch announcements count
        // const announcementsSnapshot = await getDocs(collection(db, "announcements"));
        // const activeAnnouncementsCount = announcementsSnapshot.docs.filter(
        //   doc => doc.data().status !== "Archived"
        // ).length;

        // setStats({
        //   pendingDonors: pendingDonorsCount,
        //   activeRequests: activeRequestsList.length,
        //   publishedAnnouncements: activeAnnouncementsCount,
        // });

        // Set recent requests for the feed list (top 4)
        setRecentRequests(activeRequestsList.slice(0, 4));
      } catch (error) {
        console.error("Error fetching dashboard analytics:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#D32F2F] to-red-700 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <span className="bg-white/20 text-white text-[10px] font-bold tracking-wider px-3 py-1 rounded-full uppercase">
            PRC Command Center
          </span>
          <h1 className="text-2xl sm:text-3xl font-black">Blood-Connect Admin Portal</h1>
          <p className="text-xs sm:text-sm text-red-100 max-w-xl">
            Streamlining blood donation applications, emergency patient requests, and institutional advisories across chapters.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Link
            to="/announcements"
            className="px-4 py-2.5 bg-white text-[#D32F2F] hover:bg-red-50 rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
          >
            <LuMegaphone size={15} /> Broadcast Advisory
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Pending Donors Card */}
        <Link 
          to="/donors"
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs hover:border-red-200 hover:shadow-md transition-all group flex items-center justify-between"
        >
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Pending Donors</p>
            <p className="text-3xl font-black text-gray-900 group-hover:text-[#D32F2F] transition-colors">
              {loading ? "..." : stats.pendingDonors}
            </p>
            <p className="text-[11px] text-gray-400">Requires ID & form screening</p>
          </div>
          <div className="p-3.5 bg-red-50 text-[#D32F2F] rounded-2xl group-hover:scale-110 transition-transform">
            <LuShieldCheck size={26} />
          </div>
        </Link>

        {/* Active Blood Requests Card */}
        <Link 
          to="/blood-requests"
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs hover:border-blue-200 hover:shadow-md transition-all group flex items-center justify-between"
        >
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Requests</p>
            <p className="text-3xl font-black text-gray-900 group-hover:text-blue-600 transition-colors">
              {loading ? "..." : stats.activeRequests}
            </p>
            <p className="text-[11px] text-gray-400">Hospital blood requirements</p>
          </div>
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
            <LuDroplet size={26} />
          </div>
        </Link>

        {/* Active Announcements Card */}
        <Link 
          to="/announcements/published"
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs hover:border-emerald-200 hover:shadow-md transition-all group flex items-center justify-between"
        >
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Advisories</p>
            <p className="text-3xl font-black text-gray-900 group-hover:text-emerald-600 transition-colors">
              {loading ? "..." : stats.publishedAnnouncements}
            </p>
            <p className="text-[11px] text-gray-400">Published broadcast feeds</p>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
            <LuMegaphone size={26} />
          </div>
        </Link>
      </div>

      {/* Quick Navigation / Recent Overview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Blood Requests Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Recent Blood Requests</h3>
              <p className="text-xs text-gray-500">Latest hospital requirements submitted by users</p>
            </div>
            <Link 
              to="/blood-requests" 
              className="text-xs font-bold text-[#D32F2F] hover:underline flex items-center gap-1"
            >
              View All <LuArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <p className="text-xs text-gray-400 py-6 text-center">Loading recent records...</p>
          ) : recentRequests.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 font-semibold">No active blood requests at the moment.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentRequests.map((req) => (
                <div key={req.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-gray-900">{req.patientName || "Unnamed Patient"}</p>
                    <p className="text-[11px] text-gray-500">{req.hospital || "Hospital N/A"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-red-50 text-[#D32F2F] text-[11px] font-extrabold rounded-full border border-red-100">
                      {req.bloodType || "O+"}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      req.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {req.status || "pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PRC Chapter Quick Operational Status */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">System & Chapter Status</h3>
            <p className="text-xs text-gray-500">Operational readiness overview</p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-start gap-3">
              <LuCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-900">Firestore Sync Active</p>
                <p className="text-[11px] text-emerald-700">All collections and real-time listeners are healthy.</p>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-3">
              <LuClock size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-900">Screening Protocol</p>
                <p className="text-[11px] text-blue-700">Standard PRC donor guidelines enforced.</p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/60 border border-amber-100 rounded-xl flex items-start gap-3">
              <LuClock size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-900">Inventory Notice</p>
                <p className="text-[11px] text-amber-700">Monitor rare blood types (AB-, B-) closely.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;