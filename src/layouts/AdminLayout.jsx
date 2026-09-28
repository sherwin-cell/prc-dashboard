import React, { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LuLayoutDashboard,
  LuUsers,
  LuDroplet,
  LuLogOut,
  LuBell,
  LuMessageSquare,
  LuMegaphone,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuChevronDown,
  LuChevronUp,
  LuArchive,
  LuEye,
} from "react-icons/lu";

const AdminLayout = () => {
  const { adminProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Automatically keep dropdowns open if user is inside their respective paths
  const isBloodRequestsPath = location.pathname.startsWith("/blood-requests");
  const [isBloodRequestsOpen, setIsBloodRequestsOpen] = useState(isBloodRequestsPath);

  const isDonorsPath = location.pathname.startsWith("/donors");
  const [isDonorsOpen, setIsDonorsOpen] = useState(isDonorsPath);

  const isAnnouncementsPath = location.pathname.startsWith("/announcements");
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(isAnnouncementsPath);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex">
      {/* Sidebar Navigation */}
      <aside
        className={`${
          isSidebarCollapsed ? "w-20" : "w-64"
        } bg-white border-r border-gray-200 flex flex-col justify-between shrink-0 fixed inset-y-0 left-0 z-20 transition-all duration-300 ease-in-out`}
      >
        <div>
          {/* Brand Header & Toggle */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2 overflow-hidden">
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 bg-[#D32F2F] text-white rounded-xl flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                  +
                </div>
                <div className="truncate">
                  <h1 className="font-bold text-gray-900 text-base leading-tight truncate">Blood-Connect</h1>
                  <span className="text-[10px] font-semibold tracking-wider text-[#D32F2F] uppercase block">
                    PRC Admin Portal
                  </span>
                </div>
              </div>
            )}
            {isSidebarCollapsed && (
              <div className="w-full flex justify-center">
                <div className="w-9 h-9 bg-[#D32F2F] text-white rounded-xl flex items-center justify-center font-black text-xl shadow-xs">
                  +
                </div>
              </div>
            )}
            {!isSidebarCollapsed && (
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 shrink-0"
                title="Collapse Sidebar"
              >
                <LuPanelLeftClose size={16} />
              </button>
            )}
          </div>

          {isSidebarCollapsed && (
            <div className="py-2 border-b border-gray-100 flex justify-center">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                title="Expand Sidebar"
              >
                <LuPanelLeftOpen size={16} />
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? "bg-red-50 text-[#D32F2F] font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                } ${isSidebarCollapsed ? "justify-center" : ""}`
              }
            >
              <LuLayoutDashboard size={18} className="shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Dashboard</span>}
            </NavLink>

            <NavLink
              to="/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? "bg-red-50 text-[#D32F2F] font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                } ${isSidebarCollapsed ? "justify-center" : ""}`
              }
            >
              <LuUsers size={18} className="shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Users</span>}
            </NavLink>

            {/* Blood Requests Accordion Menu */}
            {!isSidebarCollapsed ? (
              <div>
                <button
                  onClick={() => setIsBloodRequestsOpen(!isBloodRequestsOpen)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isBloodRequestsPath ? "bg-red-50 text-[#D32F2F] font-semibold" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <LuDroplet size={18} className="shrink-0" />
                    <span>Blood Requests</span>
                  </div>
                  {isBloodRequestsOpen ? <LuChevronUp size={16} /> : <LuChevronDown size={16} />}
                </button>

                {isBloodRequestsOpen && (
                  <div className="ml-5 pl-4 mt-1 border-l border-gray-200 space-y-1">
                    <NavLink
                      to="/blood-requests"
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          isActive ? "bg-red-100/60 text-[#D32F2F]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                        }`
                      }
                    >
                      <LuDroplet size={14} />
                      <span>Active Requests</span>
                    </NavLink>
                    <NavLink
                      to="/blood-requests/archive"
                      className={({ isActive }) =>
                        `flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          isActive ? "bg-red-100/60 text-[#D32F2F]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                        }`
                      }
                    >
                      <LuArchive size={14} />
                      <span>Archived Requests</span>
                    </NavLink>
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to="/blood-requests"
                title="Blood Requests"
                className={({ isActive }) =>
                  `flex items-center justify-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? "bg-red-50 text-[#D32F2F]" : "text-gray-600 hover:bg-gray-50"
                  }`
                }
              >
                <LuDroplet size={18} />
              </NavLink>
            )}

            {/* Apply Donors Accordion Menu */}
            {!isSidebarCollapsed ? (
              <div>
                <button
                  onClick={() => setIsDonorsOpen(!isDonorsOpen)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isDonorsPath ? "bg-red-50 text-[#D32F2F] font-semibold" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <LuUsers size={18} className="shrink-0" />
                    <span>Apply Donors</span>
                  </div>
                  {isDonorsOpen ? <LuChevronUp size={16} /> : <LuChevronDown size={16} />}
                </button>

                {isDonorsOpen && (
                  <div className="ml-5 pl-4 mt-1 border-l border-gray-200 space-y-1">
                    <NavLink
                      to="/donors"
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          isActive ? "bg-red-100/60 text-[#D32F2F]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                        }`
                      }
                    >
                      <LuUsers size={14} />
                      <span>Pending Donors</span>
                    </NavLink>
                    <NavLink
                      to="/donors/archive"
                      className={({ isActive }) =>
                        `flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          isActive ? "bg-red-100/60 text-[#D32F2F]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                        }`
                      }
                    >
                      <LuArchive size={14} />
                      <span>Archived Donors</span>
                    </NavLink>
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to="/donors"
                title="Apply Donors"
                className={({ isActive }) =>
                  `flex items-center justify-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? "bg-red-50 text-[#D32F2F]" : "text-gray-600 hover:bg-gray-50"
                  }`
                }
              >
                <LuUsers size={18} />
              </NavLink>
            )}

            <NavLink
              to="/chats"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? "bg-red-50 text-[#D32F2F] font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                } ${isSidebarCollapsed ? "justify-center" : ""}`
              }
            >
              <LuMessageSquare size={18} className="shrink-0" />
              {!isSidebarCollapsed && <span className="truncate">Support Chats</span>}
            </NavLink>

            {/* Announcements Accordion Menu */}
            {!isSidebarCollapsed ? (
              <div>
                <button
                  onClick={() => setIsAnnouncementsOpen(!isAnnouncementsOpen)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isAnnouncementsPath ? "bg-red-50 text-[#D32F2F] font-semibold" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <LuMegaphone size={18} className="shrink-0" />
                    <span>Announcements</span>
                  </div>
                  {isAnnouncementsOpen ? <LuChevronUp size={16} /> : <LuChevronDown size={16} />}
                </button>

                {isAnnouncementsOpen && (
                  <div className="ml-5 pl-4 mt-1 border-l border-gray-200 space-y-1">
                    <NavLink
                      to="/announcements"
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          isActive ? "bg-red-100/60 text-[#D32F2F]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                        }`
                      }
                    >
                      <LuMegaphone size={14} />
                      <span>Create Advisory</span>
                    </NavLink>
                    <NavLink
                      to="/announcements/published"
                      className={({ isActive }) =>
                        `flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          isActive ? "bg-red-100/60 text-[#D32F2F]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                        }`
                      }
                    >
                      <LuEye size={14} />
                      <span>Published List</span>
                    </NavLink>
                    <NavLink
                      to="/announcements/archive"
                      className={({ isActive }) =>
                        `flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          isActive ? "bg-red-100/60 text-[#D32F2F]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                        }`
                      }
                    >
                      <LuArchive size={14} />
                      <span>Archived History</span>
                    </NavLink>
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to="/announcements"
                title="Announcements"
                className={({ isActive }) =>
                  `flex items-center justify-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? "bg-red-50 text-[#D32F2F]" : "text-gray-600 hover:bg-gray-50"
                  }`
                }
              >
                <LuMegaphone size={18} />
              </NavLink>
            )}
          </nav>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className={`flex items-center gap-3 px-1 ${isSidebarCollapsed ? "justify-center" : ""}`}>
            <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs shrink-0">
              {adminProfile?.fullName ? adminProfile.fullName.charAt(0) : "A"}
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {adminProfile?.fullName || "PRC Administrator"}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {adminProfile?.chapter || "Red Cross Admin"}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out"
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ${
              isSidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <LuLogOut size={16} className="shrink-0" />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "pl-20" : "pl-64"
        }`}
      >
        <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-end sticky top-0 z-10">
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors relative">
            <LuBell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#D32F2F] rounded-full"></span>
          </button>
        </header>

        <main className="p-8 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;