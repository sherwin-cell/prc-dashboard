import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import {
  RequestStatus,
  isRequestOpen,
  requestStatusLabel,
  requestStatusClasses,
  faceReviewState,
  isRequestArchived,
} from '../../constants/statuses';
import {
  LuShieldCheck,
  LuDroplet,
  LuMegaphone,
  LuArrowRight,
  LuClipboardList,
  LuCalendarClock,
  LuTriangleAlert,
  LuScanFace,
  LuCircleCheck,
  LuHospital,
} from 'react-icons/lu';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const URGENT = 'urgent';

const lower = (value) => String(value ?? '').trim().toLowerCase();

// Same status precedence as the Pending Donors page.
const donorApplicationStatus = (donor) =>
  lower(donor.applicationStatus || donor.donorStatus || donor.status || 'pending');

const donorAppointmentStatus = (donor) =>
  lower(donor.appointmentStatus || donor.appointment?.status);

const isPendingRequest = (req) => lower(req.status || RequestStatus.pending) === RequestStatus.pending;
const isUrgent = (req) => lower(req.urgency) === URGENT;
const unitsOf = (req) => Number(req.unitsRequired ?? req.unitsNeeded ?? 1) || 1;

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toMillis = (value) => toDate(value)?.getTime() ?? 0;

// YYYY-MM-DD in Philippine time, matching how appointment dates are stored.
const todayInManila = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

const timeAgo = (value) => {
  const date = toDate(value);
  if (!date) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

const formatShortDate = (value) =>
  toDate(value)?.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) ?? null;

const greeting = () => {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }).format(new Date())
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const EMPTY_STATS = {
  pendingRequests: 0,
  openRequests: 0,
  urgentOpen: 0,
  pendingDonors: 0,
  appointmentsToday: 0,
  faceReviews: 0,
};

/* ---------- Presentational pieces ---------- */

const ACCENTS = {
  red: { icon: 'bg-red-50 text-[#D32F2F]', ring: 'hover:border-red-200', value: 'group-hover:text-[#D32F2F]' },
  amber: { icon: 'bg-amber-50 text-amber-600', ring: 'hover:border-amber-200', value: 'group-hover:text-amber-600' },
  blue: { icon: 'bg-blue-50 text-blue-600', ring: 'hover:border-blue-200', value: 'group-hover:text-blue-600' },
  violet: { icon: 'bg-violet-50 text-violet-600', ring: 'hover:border-violet-200', value: 'group-hover:text-violet-600' },
};

const StatTile = ({ to, label, value, hint, icon: Icon, accent, loading }) => {
  const a = ACCENTS[accent];
  return (
    <Link
      to={to}
      className={`group bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:shadow-md transition-all ${a.ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
        <span className={`p-2.5 rounded-xl ${a.icon}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className={`mt-2 text-3xl font-black text-gray-900 tabular-nums transition-colors ${a.value}`}>
        {loading ? <span className="inline-block h-8 w-12 rounded-lg bg-gray-100 animate-pulse" /> : value}
      </p>
      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
        <span className="truncate">{hint}</span>
        <LuArrowRight size={14} className="shrink-0 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
};

const Panel = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`bg-white rounded-2xl border border-gray-200 shadow-xs ${className}`}>
    <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </header>
    <div className="px-5 pb-5">{children}</div>
  </section>
);

const SkeletonRows = ({ rows = 4 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-12 rounded-xl bg-gray-50 animate-pulse" />
    ))}
  </div>
);

/* ---------- Page ---------- */

const DashboardPage = () => {
  const { adminProfile } = useAuth();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [recentRequests, setRecentRequests] = useState([]);
  const [neededByType, setNeededByType] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function fetchDashboardData() {
      // allSettled: one unreadable collection shouldn't blank the whole dashboard.
      const [donorsRes, requestsRes, usersRes] = await Promise.allSettled([
        getDocs(collection(db, 'donors')),
        getDocs(collection(db, 'blood_requests')),
        getDocs(collection(db, 'users')),
      ]);

      const failed = [donorsRes, requestsRes, usersRes].filter((r) => r.status === 'rejected');
      failed.forEach((r) => console.error('Error fetching dashboard data:', r.reason));
      if (failed.length) setLoadError("Some dashboard figures couldn't be loaded. Refresh to try again.");

      const next = { ...EMPTY_STATS };

      if (donorsRes.status === 'fulfilled') {
        const today = todayInManila();
        const donors = donorsRes.value.docs.map((d) => d.data());
        next.pendingDonors = donors.filter((d) => donorApplicationStatus(d) === 'pending').length;
        next.appointmentsToday = donors.filter(
          (d) => d.appointment?.date === today && donorAppointmentStatus(d) === 'scheduled'
        ).length;
      }

      if (requestsRes.status === 'fulfilled') {
        const requests = requestsRes.value.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        const open = requests.filter((r) => isRequestOpen(r.status));
        next.pendingRequests = requests.filter(isPendingRequest).length;
        next.openRequests = open.length;
        next.urgentOpen = open.filter(isUrgent).length;

        const byType = {};
        open.forEach((r) => {
          if (!BLOOD_TYPES.includes(r.bloodType)) return;
          byType[r.bloodType] = byType[r.bloodType] || { requests: 0, units: 0 };
          byType[r.bloodType].requests += 1;
          byType[r.bloodType].units += unitsOf(r);
        });
        setNeededByType(byType);

        setRecentRequests(requests.filter((r) => !isRequestArchived(r)).slice(0, 6));
      }

      if (usersRes.status === 'fulfilled') {
        next.faceReviews = usersRes.value.docs.filter(
          (d) => faceReviewState(d.data()) === 'needs_review'
        ).length;
      }

      setStats(next);
      setLoading(false);
    }

    fetchDashboardData();
  }, []);

  const firstName = (adminProfile?.fullName || '').split(' ')[0];
  const todayLabel = new Date().toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const attentionItems = [
    {
      key: 'urgent',
      count: stats.urgentOpen,
      label: 'urgent request(s) still open',
      to: '/blood-requests',
      icon: LuTriangleAlert,
      tone: 'text-[#D32F2F] bg-red-50',
    },
    {
      key: 'review',
      count: stats.pendingRequests,
      label: 'request(s) waiting for PRC review',
      to: '/blood-requests',
      icon: LuClipboardList,
      tone: 'text-amber-700 bg-amber-50',
    },
    {
      key: 'face',
      count: stats.faceReviews,
      label: 'identity check(s) need manual review',
      to: '/users',
      icon: LuScanFace,
      tone: 'text-violet-700 bg-violet-50',
    },
    {
      key: 'donors',
      count: stats.pendingDonors,
      label: 'donor application(s) to screen',
      to: '/donors',
      icon: LuShieldCheck,
      tone: 'text-blue-700 bg-blue-50',
    },
  ].filter((item) => item.count > 0);

  const maxUnits = Math.max(1, ...Object.values(neededByType).map((t) => t.units));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-xs p-6 sm:p-7">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-[#D32F2F]" aria-hidden="true" />
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-red-50" aria-hidden="true" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#D32F2F]">{todayLabel}</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black text-gray-900">
              {greeting()}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1 text-sm text-gray-500 max-w-xl">
              {loading
                ? 'Gathering today’s figures…'
                : attentionItems.length
                  ? `You have ${attentionItems.reduce((n, i) => n + i.count, 0)} item(s) waiting across requests, donors and users.`
                  : 'Everything is up to date. No items are waiting for PRC action.'}
            </p>
          </div>
          <Link
            to="/announcements"
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <LuMegaphone size={15} /> Broadcast Advisory
            <span className="bg-white/20 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">Soon</span>
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-800">
          <LuTriangleAlert size={16} className="shrink-0" /> {loadError}
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          to="/blood-requests"
          label="Awaiting Review"
          value={stats.pendingRequests}
          hint="New requests to approve or reject"
          icon={LuClipboardList}
          accent="amber"
          loading={loading}
        />
        <StatTile
          to="/blood-requests"
          label="Open Requests"
          value={stats.openRequests}
          hint={stats.urgentOpen ? `${stats.urgentOpen} marked urgent` : 'Open to donors'}
          icon={LuDroplet}
          accent="red"
          loading={loading}
        />
        <StatTile
          to="/donors"
          label="Donor Applications"
          value={stats.pendingDonors}
          hint="Pending ID & form screening"
          icon={LuShieldCheck}
          accent="blue"
          loading={loading}
        />
        <StatTile
          to="/donors/appointments"
          label="Appointments Today"
          value={stats.appointmentsToday}
          hint="Scheduled donor visits"
          icon={LuCalendarClock}
          accent="violet"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent requests */}
        <Panel
          className="lg:col-span-2"
          title="Recent Blood Requests"
          subtitle="Latest requests submitted from the mobile app"
          action={
            <Link to="/blood-requests" className="text-xs font-bold text-[#D32F2F] hover:underline flex items-center gap-1 shrink-0">
              View all <LuArrowRight size={14} />
            </Link>
          }
        >
          {loading ? (
            <SkeletonRows rows={5} />
          ) : recentRequests.length === 0 ? (
            <div className="py-10 text-center rounded-xl bg-gray-50 border border-dashed border-gray-200">
              <LuDroplet size={22} className="mx-auto text-gray-300" />
              <p className="mt-2 text-xs font-semibold text-gray-500">No blood requests yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentRequests.map((req) => {
                const neededBy = formatShortDate(req.neededByDate ?? req.requiredDate ?? req.neededBy);
                return (
                  <li key={req.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3.5">
                    <span className="w-11 h-11 shrink-0 rounded-xl bg-red-50 border border-red-100 text-[#D32F2F] text-xs font-black flex items-center justify-center">
                      {req.bloodType || '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900 truncate">{req.patientName || 'Unnamed patient'}</p>
                        {isUrgent(req) && (
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-600 text-white">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                        <LuHospital size={12} className="shrink-0" />
                        {req.hospitalName || req.hospital || 'Hospital not specified'}
                        <span className="text-gray-300">·</span>
                        {unitsOf(req)} unit{unitsOf(req) === 1 ? '' : 's'}
                        {neededBy && (
                          <>
                            <span className="text-gray-300">·</span> by {neededBy}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${requestStatusClasses(req.status)}`}>
                        {requestStatusLabel(req.status || RequestStatus.pending)}
                      </span>
                      <p className="text-[10px] text-gray-400">{timeAgo(req.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          {/* Needs attention */}
          <Panel title="Needs Attention" subtitle="Items waiting for PRC action">
            {loading ? (
              <SkeletonRows rows={3} />
            ) : attentionItems.length === 0 ? (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <LuCircleCheck size={18} className="text-emerald-600 shrink-0" />
                <p className="text-xs font-semibold text-emerald-800">All caught up.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {attentionItems.map(({ key, count, label, to, icon: Icon, tone }) => (
                  <li key={key}>
                    <Link
                      to={to}
                      className="group flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <span className={`p-2 rounded-lg ${tone}`}>
                        <Icon size={16} />
                      </span>
                      <p className="flex-1 text-xs text-gray-600">
                        <span className="font-black text-gray-900 tabular-nums">{count}</span> {label}
                      </p>
                      <LuArrowRight size={14} className="text-gray-300 group-hover:text-gray-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Blood type demand */}
          <Panel title="Blood Types Needed" subtitle="Units still needed by open requests">
            {loading ? (
              <SkeletonRows rows={2} />
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {BLOOD_TYPES.map((type) => {
                  const entry = neededByType[type];
                  const units = entry?.units ?? 0;
                  const intensity = units ? Math.max(0.25, units / maxUnits) : 0;
                  return (
                    <div
                      key={type}
                      title={entry ? `${entry.requests} open request(s), ${units} unit(s)` : 'No open requests'}
                      className={`rounded-xl border p-2.5 text-center ${units ? 'border-red-100' : 'border-gray-100 bg-gray-50'}`}
                      style={units ? { backgroundColor: `rgba(211, 47, 47, ${0.08 + intensity * 0.22})` } : undefined}
                    >
                      <p className={`text-sm font-black ${units ? 'text-[#B71C1C]' : 'text-gray-400'}`}>{type}</p>
                      <p className={`text-[10px] font-semibold tabular-nums ${units ? 'text-red-800' : 'text-gray-400'}`}>
                        {units ? `${units} unit${units === 1 ? '' : 's'}` : '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
