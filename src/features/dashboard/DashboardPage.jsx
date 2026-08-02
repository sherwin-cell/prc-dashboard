import React from "react";
import { LuShieldCheck, LuUsers, LuDroplet } from "react-icons/lu";

const DashboardPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-sm text-gray-500">
          Welcome to the Philippine Red Cross Blood-Connect Management Portal.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-red-50 text-[#D32F2F] rounded-xl">
            <LuShieldCheck size={28} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Pending Verifications</p>
            <p className="text-2xl font-extrabold text-gray-900">12</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <LuUsers size={28} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Registered Donors</p>
            <p className="text-2xl font-extrabold text-gray-900">1,248</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <LuDroplet size={28} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Active Blood Requests</p>
            <p className="text-2xl font-extrabold text-gray-900">5</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;