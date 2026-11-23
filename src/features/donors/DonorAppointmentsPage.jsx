import { useEffect, useState } from 'react';
import { CalendarClock, MapPin, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { subscribeToDonorAppointments, updateDonorAppointmentStatus } from '../../services/firestore/donorService';

function nameOf(d) { return d.fullName || [d.lastName, d.firstName, d.middleName].filter(Boolean).join(', ') || d.displayName || 'Unnamed donor'; }

export default function DonorAppointmentsPage() {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => subscribeToDonorAppointments((items) => { setDonors(items); setLoading(false); setError(''); }, (err) => { console.error(err); setError('Unable to load appointments. Check Firestore permissions and refresh.'); setLoading(false); }), []);

  async function updateStatus(donor, status) {
    if (!currentUser?.uid) { setError('Administrator authentication is required.'); return; }
    setBusyId(donor.id); setError('');
    try {
      const result = await updateDonorAppointmentStatus(donor.id, status, currentUser);
      if (!result?.success) throw new Error(result?.error || 'Could not update appointment.');
      setDonors((old) => status === 'cancelled' || status === 'no_show'
        ? old.filter((item) => item.id !== donor.id)
        : old.map((item) => item.id === donor.id ? { ...item, appointmentStatus: status, appointment: { ...(item.appointment || {}), status } } : item));
    } catch (err) { setError(err.message || 'Could not update appointment.'); }
    finally { setBusyId(''); }
  }

  if (loading) return <LoadingSpinner />;
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><CalendarClock size={24} /></div><div><h1 className="text-2xl font-bold text-gray-900">Donor Appointments</h1><p className="text-sm text-gray-500">Manage appointments for approved donor applicants.</p></div></header>
    {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} />{error}</div>}
    {donors.length === 0 ? <div className="rounded-2xl border bg-white p-10 text-center"><CalendarClock className="mx-auto text-gray-300" size={34} /><p className="mt-3 font-semibold text-gray-800">No scheduled appointments</p><p className="mt-1 text-sm text-gray-500">Approve an application and schedule an appointment from its detail page.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{donors.map((donor) => { const a = donor.appointment || {}; return <article key={donor.id} className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-gray-900">{nameOf(donor)}</h2><p className="text-sm text-gray-500">{donor.email || 'No email provided'} · {donor.bloodType || 'Blood type N/A'}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase text-blue-700">{donor.appointmentStatus || a.status || 'scheduled'}</span></div><div className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm"><p><strong>Date:</strong> {a.date || 'N/A'}</p><p><strong>Time:</strong> {a.time || 'N/A'}</p><p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0" /><span>{a.location || 'Location not provided'}</span></p>{a.notes && <p><strong>Notes:</strong> {a.notes}</p>}</div><div className="flex flex-wrap gap-2"><button disabled={!!busyId} onClick={() => updateStatus(donor, 'completed')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><CheckCircle className="mr-1 inline" size={16} />{busyId === donor.id ? 'Saving...' : 'Mark Appointment Completed'}</button><button disabled={!!busyId} onClick={() => updateStatus(donor, 'no_show')} className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50">No-show</button><button disabled={!!busyId} onClick={() => updateStatus(donor, 'cancelled')} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"><XCircle className="mr-1 inline" size={16} />Cancel</button></div></article>; })}</div>}
    <p className="text-xs text-gray-500">Mark an appointment completed only after the visit has occurred. Screening and collection are recorded on the Screening & Collection page.</p>
  </div>;
}
