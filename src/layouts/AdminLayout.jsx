import { useState } from "react";
import { Outlet, NavLink, Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  LuLayoutDashboard,
  LuUsers,
  LuDroplet,
  LuLogOut,
  LuBell,
  LuMessageSquare,
  LuMessageCircle,
  LuMegaphone,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuChevronDown,
  LuChevronUp,
  LuArchive,
  LuCalendarClock,
  LuClipboardCheck,
  LuHeartPulse,
  LuSearch,
  LuUserCheck,
} from "react-icons/lu";
import { useBackendStatus } from "../hooks/useBackendStatus";
import { usePendingRequestCount } from "../hooks/usePendingRequestCount";

const BACKEND_PILL = {
  online: { label: "Backend Online", dot: "bg-emerald-500", classes: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  offline: { label: "Backend Offline", dot: "bg-rose-500", classes: "border-rose-200 bg-rose-50 text-rose-800" },
  checking: { label: "Checking backend", dot: "bg-gray-400 animate-pulse", classes: "border-gray-200 bg-gray-50 text-gray-600" },
  unconfigured: { label: "Backend not set", dot: "bg-amber-500", classes: "border-amber-200 bg-amber-50 text-amber-800" },
};

const DONOR_LINKS = [
  { to: "/donors", end: true, icon: LuUserCheck, label: "Donor Applications" },
  { to: "/donors/appointments", icon: LuCalendarClock, label: "Appointments" },
  { to: "/donors/screening", icon: LuClipboardCheck, label: "Screening & Collection" },
  { to: "/donors/active", icon: LuHeartPulse, label: "Donors" },
  { to: "/donors/archive", icon: LuArchive, label: "Archived Donors" },
];

const SectionLabel = ({ collapsed, children }) =>
  collapsed ? (
    <div className="mx-auto my-3 h-px w-8 bg-white/10" />
  ) : (
    <p className="px-3.5 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{children}</p>
  );

const linkClasses = (active, collapsed) =>
  `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
    active ? "bg-[#D91E2A] text-white shadow-sm shadow-red-950/40" : "text-zinc-400 hover:bg-white/5 hover:text-white"
  } ${collapsed ? "justify-center" : ""}`;

const AdminLayout = () => {
  const { adminProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const pendingCount = usePendingRequestCount();
  const backend = BACKEND_PILL[useBackendStatus()];

  const isDonorsPath = location.pathname.startsWith("/donors");
  const [isDonorsOpen, setIsDonorsOpen] = useState(isDonorsPath);
  const isAnnouncementsPath = location.pathname.startsWith("/announcements");

  // The header search filters the Blood Requests page through ?q=. Elsewhere
  // it is a draft that opens that page on Enter.
  const onRequestsPage = location.pathname === "/blood-requests";
  const [searchDraft, setSearchDraft] = useState("");
  const searchValue = onRequestsPage ? params.get("q") || "" : searchDraft;
  const onSearchChange = (value) => {
    if (!onRequestsPage) return setSearchDraft(value);
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true }
    );
  };
  const onSearchSubmit = (event) => {
    event.preventDefault();
    if (onRequestsPage || !searchDraft.trim()) return;
    navigate(`/blood-requests?tab=all&q=${encodeURIComponent(searchDraft.trim())}`);
    setSearchDraft("");
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  const adminName = adminProfile?.fullName || "PRC Administrator";
  const initials = adminName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen bg-[#F4F5F7]">
      <aside
        className={`${collapsed ? "w-20" : "w-64"} fixed inset-y-0 left-0 z-30 flex shrink-0 flex-col justify-between bg-[#18181B] text-zinc-300 transition-all duration-300 ease-in-out`}
      >
        <div className="min-h-0 overflow-y-auto">
          {/* Brand */}
          <div className={`flex items-center gap-3 border-b border-white/5 px-4 py-5 ${collapsed ? "flex-col" : ""}`}>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#E0313C] to-[#991B1B] text-white shadow-lg shadow-red-950/50">
              <LuDroplet size={20} className="fill-white/90" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-extrabold leading-tight text-white">BloodConnect</h1>
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#F0545D]">PRC Sorsogon Admin</span>
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <LuPanelLeftOpen size={16} /> : <LuPanelLeftClose size={16} />}
            </button>
          </div>

          <nav className="px-3 pb-4">
            <SectionLabel collapsed={collapsed}>Overview</SectionLabel>
            <div className="space-y-1">
              <NavLink to="/" end title="Dashboard" className={({ isActive }) => linkClasses(isActive, collapsed)}>
                <LuLayoutDashboard size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">Dashboard</span>}
              </NavLink>

              <NavLink
                to="/blood-requests"
                title="Blood Requests"
                className={({ isActive }) => `${linkClasses(isActive, collapsed)} relative`}
              >
                <LuDroplet size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">Blood Requests</span>}
                {pendingCount > 0 &&
                  (collapsed ? (
                    <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-[#F0545D] ring-2 ring-[#18181B]" />
                  ) : (
                    <span
                      title={`${pendingCount} waiting for review`}
                      className="ml-auto min-w-5 rounded-full bg-white px-1.5 text-center text-[10px] font-bold tabular-nums text-[#D91E2A]"
                    >
                      {pendingCount}
                    </span>
                  ))}
              </NavLink>

              {collapsed ? (
                <NavLink to="/donors" title="Apply Donors" className={({ isActive }) => linkClasses(isActive || isDonorsPath, true)}>
                  <LuUsers size={18} />
                </NavLink>
              ) : (
                <div>
                  <button
                    onClick={() => setIsDonorsOpen(!isDonorsOpen)}
                    aria-expanded={isDonorsOpen}
                    className={`${linkClasses(false, false)} w-full justify-between ${isDonorsPath ? "text-white" : ""}`}
                  >
                    <span className="flex items-center gap-3">
                      <LuUsers size={18} className="shrink-0" />
                      Apply Donors
                    </span>
                    {isDonorsOpen ? <LuChevronUp size={15} /> : <LuChevronDown size={15} />}
                  </button>
                  {isDonorsOpen && (
                    <div className="ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                      {DONOR_LINKS.map(({ to, end, icon: Icon, label }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          className={({ isActive }) =>
                            `flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                              isActive ? "bg-white/10 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                            }`
                          }
                        >
                          <Icon size={14} />
                          <span className="truncate">{label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <NavLink to="/users" title="Users" className={({ isActive }) => linkClasses(isActive, collapsed)}>
                <LuUsers size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">Users</span>}
              </NavLink>
            </div>

            <SectionLabel collapsed={collapsed}>Communication &amp; System</SectionLabel>
            <div className="space-y-1">
              <NavLink to="/chats" title="Support Chats" className={({ isActive }) => linkClasses(isActive, collapsed)}>
                <LuMessageSquare size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">Support Chats</span>}
              </NavLink>

              {/* Announcements: deferred. */}
              <NavLink
                to="/announcements"
                title="Announcements (under development)"
                className={() => linkClasses(isAnnouncementsPath, collapsed)}
              >
                <LuMegaphone size={18} className="shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate">Announcements</span>
                    <span className="ml-auto rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">Soon</span>
                  </>
                )}
              </NavLink>
            </div>
          </nav>
        </div>

        {/* Signed-in administrator */}
        <div className="border-t border-white/5 p-3">
          <div className={`flex items-center gap-3 rounded-xl bg-white/5 p-2.5 ${collapsed ? "flex-col" : ""}`}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 text-xs font-bold text-white ring-2 ring-white/10">
              {initials || "A"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{adminName}</p>
                <p className="truncate text-[11px] text-zinc-500">{adminProfile?.chapter || "PRC Sorsogon Chapter"}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Sign out"
              className="shrink-0 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
            >
              <LuLogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className={`flex min-h-screen min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? "pl-20" : "pl-64"}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-gray-200 bg-white/90 px-8 backdrop-blur">
          <form onSubmit={onSearchSubmit} className="relative w-full max-w-md" role="search">
            <LuSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search requests, patients, hospitals..."
              aria-label="Search requests, patients, hospitals"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm text-gray-800 transition-colors focus:border-[#D91E2A] focus:bg-white focus:outline-none"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <span className={`hidden items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold sm:inline-flex ${backend.classes}`}>
              <span className={`h-2 w-2 rounded-full ${backend.dot}`} />
              {backend.label}
            </span>
            <Link
              to="/blood-requests?tab=pending"
              title={pendingCount ? `${pendingCount} request(s) waiting for review` : "No requests waiting for review"}
              className="relative rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            >
              <LuBell size={19} />
              {pendingCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#D91E2A] ring-2 ring-white" />}
            </Link>
            <Link to="/chats" title="Support Chats" className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800">
              <LuMessageCircle size={19} />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
