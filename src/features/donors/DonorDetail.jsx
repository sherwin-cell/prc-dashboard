
import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';

const QUESTIONS = [
  ['1', 'Do you feel well and healthy today?'],
  ['2', 'Have you ever been refused as a blood donor or told not to donate?'],
  ['3', 'In the last 12 hours, have you consumed alcohol?'],
  ['4', 'In the past 4 weeks, have you taken medications or vaccinations?'],
  ['5', 'In the past 3 months, have you donated whole blood, platelets, or plasma?'],
  ['6', 'In the past 12 months, have you had surgery, dental extraction, tattoo, or piercing?'],
  ['7', 'Have you had sexual contact involving potential high-risk exposure?'],
  ['8', 'Have you had jaundice, hepatitis, or contact with someone who had hepatitis?'],
  ['9', 'Have you taken prohibited drugs orally, nasally, or by injection?'],
  ['10', 'Have you tested positive for HIV, hepatitis, syphilis, or malaria?'],
  ['11', 'For females: Are you currently pregnant, or have you ever been pregnant?'],
];

function formatDate(value) {
  if (!value) return 'N/A';

  let date;

  if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (typeof value?.seconds === 'number') {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }

  return Number.isNaN(date.getTime())
    ? 'N/A'
    : date.toLocaleDateString();
}

function yesNo(value) {
  if (value === true || String(value).toLowerCase() === 'yes') {
    return 'Yes';
  }

  if (value === false || String(value).toLowerCase() === 'no') {
    return 'No';
  }

  return 'Not answered';
}

function getTodayString() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function DonorDetail({
  donor,
  onBack,
  onUpdateStatus,
  onScheduleAppointment,
}) {
  // Live donor from the parent, plus fields this screen just saved
  // (shown until the Firestore snapshot catches up).
  const [overrides, setOverrides] = useState({});
  const data = { ...(donor || {}), ...overrides };
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [reason, setReason] = useState('');
  const [reapplicationAllowed, setReapplicationAllowed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [error, setError] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  const [appointmentForm, setAppointmentForm] = useState({
    date: '',
    time: '',
    location: '',
    notes: '',
  });

  const status = String(
    data.applicationStatus ||
    data.donorStatus ||
    data.status ||
    'pending'
  ).toLowerCase();

  const approved = status === 'approved';

  const appointment = data.appointment || {};

  const appointmentStatus = String(
    data.appointmentStatus || appointment.status || ''
  ).toLowerCase();

  const scheduled = ['scheduled', 'completed'].includes(
    appointmentStatus
  );

  const name =
    data.fullName ||
    [
      data.lastName,
      [data.firstName, data.middleName].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(', ') ||
    data.displayName ||
    'Name not available';


  const idSubmissionStatus =
    data.accountIdVerificationStatus || "unavailable";

  const hasSavedId = idSubmissionStatus === "submitted";

  const front = hasSavedId
    ? data.idVerification?.frontIdImageUrl || null
    : null;

  const back = hasSavedId
    ? data.idVerification?.backIdImageUrl || null
    : null;

  const idStatusLabel = {
    submitted: "Submitted",
    not_submitted: "Not Submitted",
    incomplete: "Incomplete Submission",
    unavailable: "Unavailable",
  }[idSubmissionStatus] || "Unavailable";


  const answers = data.eligibilityAnswers || {};

  function updateAppointmentField(field, value) {
    setAppointmentForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function submitStatus(nextStatus) {
    setBusy(true);
    setError('');

    try {
      const result = await onUpdateStatus(
        data.id,
        nextStatus,
        nextStatus === 'rejected' ? reason.trim() : '',
        nextStatus === 'rejected' ? reapplicationAllowed : null
      );

      if (result?.success === false) {
        throw new Error(result.error || 'Update failed.');
      }

      setOverrides((old) => ({
        ...old,
        applicationStatus: nextStatus,
        donorStatus: nextStatus,
        status: nextStatus,
        rejectionReason:
          nextStatus === 'rejected' ? reason.trim() : '',
        reapplicationAllowed:
          nextStatus === 'rejected' ? reapplicationAllowed === true : false,
      }));

      setShowApprove(false);
      setShowReject(false);
      setReason('');
      setReapplicationAllowed(null);
    } catch (err) {
      setError(err.message || 'Could not update application.');
    } finally {
      setBusy(false);
    }
  }

  async function submitAppointment(event) {
    event.preventDefault();
    setScheduleError('');

    if (
      !appointmentForm.date ||
      !appointmentForm.time ||
      !appointmentForm.location.trim()
    ) {
      setScheduleError(
        'Please provide an appointment date, time, and location.'
      );
      return;
    }

    if (appointmentForm.date < getTodayString()) {
      setScheduleError(
        'Please select today or a future appointment date.'
      );
      return;
    }

    if (typeof onScheduleAppointment !== 'function') {
      setScheduleError(
        'Appointment scheduling is not connected. Please check the donor page integration.'
      );
      return;
    }

    setScheduleBusy(true);

    try {
      const result = await onScheduleAppointment({
        ...appointmentForm,
        location: appointmentForm.location.trim(),
        notes: appointmentForm.notes.trim(),
      });

      if (result?.success === false) {
        throw new Error(
          result.error || 'Could not schedule the appointment.'
        );
      }

      setOverrides((previous) => ({
        ...previous,
        appointment: {
          ...(previous.appointment || donor?.appointment),
          ...appointmentForm,
          location: appointmentForm.location.trim(),
          notes: appointmentForm.notes.trim(),
          status: 'scheduled',
        },
        appointmentStatus: 'scheduled',
      }));

      setShowSchedule(false);
      setScheduleError('');
    } catch (err) {
      setScheduleError(
        err.message || 'Could not schedule the appointment.'
      );
    } finally {
      setScheduleBusy(false);
    }
  }

  const fieldClass =
    'mt-1.5 w-full rounded-xl border border-gray-200 bg-white ' +
    'px-3.5 py-3 text-sm text-gray-800 outline-none transition ' +
    'focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center gap-3 border-b pb-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full p-2 hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            Donor Application Details
          </h1>
          <p className="text-xs text-gray-500">
            Review the applicant before making a decision.
          </p>
        </div>

        <span className="rounded-full border px-3 py-1 text-xs font-bold uppercase">
          {status}
        </span>
      </header>

      {error && (
        <div
          role="alert"
          className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <section className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">{name}</h2>
            <p className="text-sm text-gray-500">
              {data.email || 'No email provided'}
            </p>
          </div>

          <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
            Blood Type: {data.bloodType || 'N/A'}
          </span>
        </div>

        <section>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  One-Time Government ID Submission
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  This ID is saved to the user's account and reused
                  for future applications and blood requests.
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${hasSavedId
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                  }`}
              >
                {idStatusLabel}
              </span>
            </div>

            {hasSavedId && front && back ? (
              <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
                <a
                  href={front}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                >
                  View Front ID
                </a>

                <a
                  href={back}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                >
                  View Back ID
                </a>
              </div>
            ) : (
              <p className="mt-4 border-t pt-4 text-sm text-gray-500">
                {idSubmissionStatus === "not_submitted"
                  ? "No government ID has been submitted."
                  : idSubmissionStatus === "incomplete"
                    ? "The saved ID record is missing required images."
                    : "Saved ID images are not available."}
              </p>
            )}

            <p className="mt-4 text-xs text-gray-500">
              ID submission confirms that images were uploaded.
              It does not confirm the authenticity of the ID or
              automatically approve the donor application.
            </p>
          </div>


          <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-4">
            {[
              ['Birthday', formatDate(data.birthday)],
              ['Age', data.age],
              ['Sex', data.sex],
              ['Civil Status', data.civilStatus],
              ['Nationality', data.nationality],
              ['Education', data.education],
              ['Occupation', data.occupation],
              ['Religion', data.religion],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 font-medium">{value || 'N/A'}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-800">
            <MapPin size={16} />
            Address & Contact
          </h3>

          <div className="grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2">
            <p>
              <span className="text-gray-500">Permanent address:</span>
              <br />
              {data.permanentAddress || 'N/A'}
            </p>
            <p>
              <span className="text-gray-500">Office address:</span>
              <br />
              {data.officeAddress || 'N/A'}
            </p>
            <p>
              <span className="text-gray-500">Mobile:</span>
              <br />
              {data.mobileNo || 'N/A'}
            </p>
            <p>
              <span className="text-gray-500">Telephone:</span>
              <br />
              {data.telephone || 'N/A'}
            </p>
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-800">
            <FileText size={16} />
            Donation History
          </h3>

          <div className="grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-3">
            <p>
              <span className="text-gray-500">Last donation:</span>
              <br />
              {formatDate(
                data.lastDonationDate || data.selfReportedLastDonationDate
              )}
              {!data.lastDonationDate &&
                data.selfReportedLastDonationDate && (
                  <span className="text-xs text-gray-500">
                    {' '}
                    (applicant-reported)
                  </span>
                )}
            </p>
            <p>
              <span className="text-gray-500">
                Available for donation:
              </span>
              <br />
              {data.isAvailableForDonation === true
                ? 'Yes'
                : data.isAvailableForDonation === false
                  ? 'No'
                  : data.selfReportedAvailable === true
                    ? 'Applicant says yes (not confirmed by PRC)'
                    : data.selfReportedAvailable === false
                      ? 'Applicant says no (not confirmed by PRC)'
                      : 'N/A'}
            </p>
            <p>
              <span className="text-gray-500">Activation:</span>
              <br />
              {data.donorActivationStatus || 'Not active'}
            </p>
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-800">
            <ShieldCheck size={16} />
            Eligibility Responses
          </h3>

          <div className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4 text-sm">
            {QUESTIONS.map(([key, question]) => (
              <div
                key={key}
                className="flex items-start justify-between gap-4 border-b border-amber-100 pb-3 last:border-0 last:pb-0"
              >
                <p>{question}</p>
                <strong className="shrink-0">
                  {yesNo(answers[key] ?? answers[Number(key)])}
                </strong>
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs text-gray-500">
            These self-reported answers are not a substitute for
            professional screening.
          </p>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-800">
            <ShieldCheck size={16} />
            Identity Documents
          </h3>

          {front || back ? (
            <div className="flex flex-wrap gap-3 rounded-xl bg-blue-50 p-4">
              {front && (
                <a
                  className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-blue-700"
                  href={front}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Front ID
                </a>
              )}

              {back && (
                <a
                  className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-blue-700"
                  href={back}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Back ID
                </a>
              )}
            </div>
          ) : (
            <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
              No identity document images found.
            </p>
          )}

          <p className="mt-2 text-xs text-gray-500">
            Account ID verification:{' '}
            {data.accountIdVerificationStatus || 'Unavailable'}
          </p>
        </section>

        {status === 'rejected' && data.rejectionReason && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Rejection reason:</strong> {data.rejectionReason}
            <p className="mt-1">
              <strong>Reapplication allowed:</strong>{' '}
              {data.reapplicationAllowed === true ? 'Yes' : 'No'}
            </p>
          </div>
        )}

        {status === 'pending' && (
          <section className="border-t pt-5">
            <h3 className="font-bold">Application Review</h3>
            <p className="mt-1 text-sm text-gray-500">
              Approval allows appointment scheduling only. It does not
              activate the donor.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setShowReject(true);
                }}
                disabled={busy}
                className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 disabled:opacity-50"
              >
                <XCircle className="mr-2 inline" size={18} />
                Reject Application
              </button>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setShowApprove(true);
                }}
                disabled={busy}
                className="flex-1 rounded-xl bg-green-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                <CheckCircle className="mr-2 inline" size={18} />
                Approve Application
              </button>
            </div>
          </section>
        )}
      </section>

      {approved && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-3 text-blue-700">
              <CalendarClock size={23} />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-blue-950">
                {scheduled
                  ? 'Appointment Details'
                  : 'Next Step: Schedule Appointment'}
              </h3>

              <p className="mt-1 text-sm text-blue-900">
                {scheduled
                  ? 'Review the scheduled PRC appointment below.'
                  : 'Choose an appropriate date, time, and venue for the applicant.'}
              </p>

              {scheduled && (
                <div className="mt-3 space-y-2 rounded-xl border border-blue-100 bg-white p-4 text-sm">
                  <p>
                    <strong>Date:</strong> {appointment.date || 'N/A'}
                  </p>
                  <p>
                    <strong>Time:</strong> {appointment.time || 'N/A'}
                  </p>
                  <p>
                    <strong>Location:</strong>{' '}
                    {appointment.location || 'N/A'}
                  </p>
                  <p>
                    <strong>Status:</strong>{' '}
                    {appointmentStatus || 'scheduled'}
                  </p>
                  {appointment.notes && (
                    <p>
                      <strong>Notes:</strong> {appointment.notes}
                    </p>
                  )}
                </div>
              )}

              {!scheduled && (
                <button
                  type="button"
                  onClick={() => {
                    setScheduleError('');
                    setShowSchedule(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-800 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-900"
                >
                  <CalendarClock size={18} />
                  Schedule Appointment
                </button>
              )}

              <p className="mt-3 text-xs text-blue-800">
                Donor activation remains separate and should occur only
                after the required screening and collection steps.
              </p>
            </div>
          </div>
        </section>
      )}

      {showSchedule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !scheduleBusy) {
              setShowSchedule(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-title"
            className="my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <CalendarClock size={25} />
                </div>

                <div>
                  <h2
                    id="schedule-title"
                    className="text-xl font-bold text-gray-900"
                  >
                    Schedule Appointment
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Arrange the applicant's PRC visit.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSchedule(false)}
                disabled={scheduleBusy}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label="Close appointment form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitAppointment}>
              <div className="space-y-5 px-6 py-6">
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    Donor applicant
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {name}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {data.email || 'No email provided'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    <span className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-blue-700" />
                      Appointment date *
                    </span>
                    <input
                      type="date"
                      min={getTodayString()}
                      value={appointmentForm.date}
                      onChange={(event) =>
                        updateAppointmentField('date', event.target.value)
                      }
                      required
                      className={fieldClass}
                    />
                  </label>

                  <label className="block text-sm font-semibold text-gray-700">
                    <span className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-700" />
                      Appointment time *
                    </span>
                    <input
                      type="time"
                      value={appointmentForm.time}
                      onChange={(event) =>
                        updateAppointmentField('time', event.target.value)
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                </div>

                <label className="block text-sm font-semibold text-gray-700">
                  <span className="flex items-center gap-2">
                    <MapPin size={16} className="text-blue-700" />
                    Screening location *
                  </span>
                  <input
                    type="text"
                    value={appointmentForm.location}
                    onChange={(event) =>
                      updateAppointmentField('location', event.target.value)
                    }
                    placeholder="PRC chapter or screening venue"
                    maxLength={200}
                    required
                    className={fieldClass}
                  />
                </label>

                <label className="block text-sm font-semibold text-gray-700">
                  <span className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-700" />
                    Instructions and notes
                  </span>
                  <textarea
                    value={appointmentForm.notes}
                    onChange={(event) =>
                      updateAppointmentField('notes', event.target.value)
                    }
                    placeholder="Bring a valid ID or other appointment instructions..."
                    rows={3}
                    maxLength={1000}
                    className={`${fieldClass} resize-y`}
                  />
                </label>

                <div className="flex gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
                  <ShieldCheck size={20} className="mt-0.5 shrink-0" />
                  <p>
                    Scheduling does not activate a donor. Screening
                    results and collection records must be handled
                    separately.
                  </p>
                </div>

                {scheduleError && (
                  <div
                    role="alert"
                    className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    <AlertTriangle size={18} className="shrink-0" />
                    {scheduleError}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowSchedule(false)}
                  disabled={scheduleBusy}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={scheduleBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-800 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CalendarClock size={18} />
                  {scheduleBusy
                    ? 'Saving appointment...'
                    : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showApprove && (
        <Modal
          title="Approve Donor Application?"
          onClose={() => setShowApprove(false)}
        >
          <p className="text-sm text-gray-600">
            This approves the application only. The applicant still needs
            an appointment, screening, and collection before activation.
          </p>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowApprove(false)}
              className="rounded-xl border px-4 py-2.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => submitStatus('approved')}
              className="rounded-xl bg-green-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Approving...' : 'Confirm Approval'}
            </button>
          </div>
        </Modal>
      )}

      {showReject && (
        <Modal
          title="Reject Donor Application"
          onClose={() => {
            if (!busy) {
              setShowReject(false);
              setReason('');
              setReapplicationAllowed(null);
            }
          }}
        >
          <label className="mb-2 block text-sm font-semibold">
            Rejection reason
          </label>

          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={1000}
            className="w-full rounded-xl border p-3 text-sm focus:border-red-400 focus:outline-none focus:ring-4 focus:ring-red-100"
            placeholder="Explain why this application is being rejected..."
          />

          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-semibold">
              Reapplication Allowed
            </legend>
            <div className="flex gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="reapplicationAllowed"
                  checked={reapplicationAllowed === true}
                  onChange={() => setReapplicationAllowed(true)}
                />
                Yes
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="reapplicationAllowed"
                  checked={reapplicationAllowed === false}
                  onChange={() => setReapplicationAllowed(false)}
                />
                No
              </label>
            </div>
          </fieldset>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setShowReject(false);
                setReason('');
                setReapplicationAllowed(null);
              }}
              className="rounded-xl border px-4 py-2.5 text-sm"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={busy || !reason.trim() || reapplicationAllowed === null}
              onClick={() => submitStatus('rejected')}
              className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
