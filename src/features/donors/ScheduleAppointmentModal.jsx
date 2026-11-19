
import { useState } from 'react';
import {
  CalendarClock,
  CalendarDays,
  Clock,
  MapPin,
  FileText,
  X,
} from 'lucide-react';

export default function ScheduleAppointmentModal({
  donor,
  onClose,
  onSchedule,
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const today = new Date();
  const minDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!date || !time || !location.trim()) {
      setError('Please complete the date, time, and location.');
      return;
    }

    if (date < minDate) {
      setError('Please choose today or a future date.');
      return;
    }

    try {
      setSaving(true);

      await onSchedule({
        date,
        time,
        location: location.trim(),
        notes: notes.trim(),
      });

      onClose();
    } catch (err) {
      setError(err.message || 'Unable to schedule the appointment.');
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-white ' +
    'px-3.5 py-3 text-sm text-slate-800 outline-none transition ' +
    'focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
      overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-title"
        className="my-auto w-full max-w-xl overflow-hidden rounded-2xl
          bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b
          border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center
              rounded-xl bg-blue-50 text-blue-700">
              <CalendarClock size={25} />
            </div>

            <div>
              <h2 id="schedule-title"
                className="text-xl font-bold text-slate-900">
                Schedule Appointment
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Set the applicant's PRC screening schedule.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400
              hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-6">
            <div className="rounded-xl border border-blue-100
              bg-blue-50/70 p-4">
              <p className="text-xs font-semibold uppercase
                tracking-wider text-blue-700">
                Donor applicant
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {donor?.fullName ||
                  donor?.name ||
                  donor?.displayName ||
                  'Selected applicant'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Schedule confirmation does not activate donor status.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-blue-700" />
                  Appointment date *
                </span>
                <input
                  type="date"
                  min={minDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className={fieldClass}
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center gap-2">
                  <Clock size={16} className="text-blue-700" />
                  Appointment time *
                </span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className={fieldClass}
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-700">
              <span className="flex items-center gap-2">
                <MapPin size={16} className="text-blue-700" />
                Screening location *
              </span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="PRC chapter or screening venue"
                required
                maxLength={200}
                className={fieldClass}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              <span className="flex items-center gap-2">
                <FileText size={16} className="text-blue-700" />
                Instructions and notes
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bring a valid ID, arrival instructions, etc."
                rows={3}
                maxLength={1000}
                className={fieldClass + ' resize-y'}
              />
            </label>

            {error && (
              <div role="alert"
                className="rounded-xl border border-red-200
                  bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t
            border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row
            sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200
                bg-white px-5 py-3 text-sm font-semibold
                text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2
                rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold
                text-white shadow-sm hover:bg-blue-800
                disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CalendarClock size={17} />
              {saving ? 'Saving appointment...' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
