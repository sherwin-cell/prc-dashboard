import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LuLayoutDashboard,
  LuShieldCheck,
  LuUsers,
  LuDroplet,
  LuLogOut,
  LuBell,
} from "react-icons/lu";

const AdminLayout = () => {
  const { adminProfile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  const navItems = [
    { label: "Dashboard", path: "/", icon: LuLayoutDashboard },
    { label: "Verifications", path: "/verifications", icon: LuShieldCheck },
    // Prepared for future modules:
    // { label: "Donors", path: "/donors", icon: LuUsers },
    // { label: "Blood Requests", path: "/requests", icon: LuDroplet },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between shrink-0 fixed inset-y-0 left-0 z-20">
        <div>
          {/* Brand Header */}
          <div className="p-6 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#D32F2F] text-white rounded-xl flex items-center justify-center font-black text-xl shadow-xs">
              +
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-base leading-tight">Blood-Connect</h1>
              <span className="text-[10px] font-semibold tracking-wider text-[#D32F2F] uppercase block">
                PRC Admin Portal
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-red-50 text-[#D32F2F] font-semibold"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout Button */}
        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs shrink-0">
              {adminProfile?.fullName ? adminProfile.fullName.charAt(0) : "A"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-900 truncate">
                {adminProfile?.fullName || "PRC Administrator"}
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {adminProfile?.chapter || "Red Cross Admin"}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LuLogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 pl-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-end sticky top-0 z-10">
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors relative">
            <LuBell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#D32F2F] rounded-full"></span>
          </button>
        </header>

        {/* Dynamic Page Content */}
        <main className="p-8 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;