import { useEffect, useMemo, useState } from "react";
import { LuArrowLeft, LuSearch, LuRefreshCw, LuTrash2, LuCheck } from "react-icons/lu";
import {
  getUsers,
  getUserIdSubmission,
  getFaceVerificationAttempts,
  reviewFaceVerification,
  deleteUserAccount,
} from "../../services/firestore/userService";
import { useAuth } from "../../context/useAuth";
import {
  faceAttemptLabel,
  faceReviewClasses,
  faceReviewLabel,
  faceReviewState,
} from "../../constants/statuses";

const display = (value) => value === null || value === undefined || value === "" ? "N/A" : String(value);
const formatDate = (value) => {
  if (!value) return "N/A";
  try {
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  } catch { return "N/A"; }
};
const formatScore = (value) => typeof value === "number" ? value.toFixed(3) : "N/A";

const PROVIDERS = { opencv_sface: "OpenCV SFace (open-source, server-side)" };
const METHODS = { automatic: "Automatic face match", admin_review: "PRC manual review" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "needs_review", label: "Needs review" },
  { key: "not_started", label: "Not verified" },
  { key: "verified", label: "Verified" },
];

function Info({ label, value }) {
  return <div><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900 break-words">{display(value)}</p></div>;
}

function StateBadge({ user }) {
  const state = faceReviewState(user);
  return <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${faceReviewClasses(state)}`}>{faceReviewLabel(state)}</span>;
}

/**
 * Selfie next to the ID's front photo so PRC can compare faces by eye.
 * The ID photo stays hidden until asked for: this page is a general user
 * directory and ID photos are otherwise not shown here.
 */
function PhotoComparison({ selfieUrl, selfieLabel, idUrl, loading }) {
  const [showId, setShowId] = useState(false);
  if (loading) return <p className="text-sm text-gray-500">Loading selfies...</p>;
  if (!selfieUrl && !idUrl) return <p className="text-sm text-gray-500">No selfie stored yet.</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-4">
        <figure>
          {selfieUrl
            ? <a href={selfieUrl} target="_blank" rel="noreferrer noopener"><img src={selfieUrl} alt="Selfie" className="w-40 h-40 rounded-xl border object-cover" referrerPolicy="no-referrer" /></a>
            : <div className="w-40 h-40 rounded-xl border bg-gray-50 grid place-items-center text-xs text-gray-400">No selfie stored</div>}
          <figcaption className="text-xs text-gray-500 mt-1 max-w-40">{selfieLabel}</figcaption>
        </figure>
        {idUrl && showId && (
          <figure>
            <a href={idUrl} target="_blank" rel="noreferrer noopener"><img src={idUrl} alt="ID front" className="h-40 rounded-xl border object-contain bg-gray-50" referrerPolicy="no-referrer" /></a>
            <figcaption className="text-xs text-gray-500 mt-1">ID front photo</figcaption>
          </figure>
        )}
      </div>
      {idUrl && (
        <button type="button" onClick={() => setShowId((value) => !value)} className="text-sm text-red-700 underline">
          {showId ? "Hide ID photo" : "Compare with ID photo"}
        </button>
      )}
    </div>
  );
}

function FaceReview({ user, idSubmission, onReviewed }) {
  const { currentUser } = useAuth();
  const face = user.faceVerification || {};
  const state = faceReviewState(user);
  const [attempts, setAttempts] = useState([]);
  const [attemptsLoading, setAttemptsLoading] = useState(true);
  const [attemptsError, setAttemptsError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Keyed by user in the parent, so this starts fresh (loading) per user.
  useEffect(() => {
    let active = true;
    getFaceVerificationAttempts(user.uid)
      .then((rows) => { if (active) setAttempts(rows); })
      .catch((err) => { if (active) setAttemptsError(err.message || "Could not load attempts."); })
      .finally(() => { if (active) setAttemptsLoading(false); });
    return () => { active = false; };
  }, [user.uid]);

  const review = async (approve) => {
    const verb = approve ? "approve" : "reject";
    if (!approve && !note.trim()) {
      setReviewError("Add a short reason before rejecting.");
      return;
    }
    if (!window.confirm(`${approve ? "Approve" : "Reject"} this user's identity? This ${approve ? "unlocks" : "keeps locked"} blood requests and donor features.`)) return;
    setBusy(true);
    setReviewError("");
    try {
      await reviewFaceVerification(user.uid, approve, currentUser, note);
      setNote("");
      onReviewed();
    } catch (err) {
      setReviewError(err.message || `Could not ${verb} this user.`);
    } finally {
      setBusy(false);
    }
  };

  const threshold = face.threshold;
  const score = face.score;
  // Attempts are newest first; the first with a stored selfie is the latest one.
  const latestReviewSelfie = attempts.find((attempt) => attempt.selfieImageUrl);
  const canApprove = state !== "verified";
  const canReject = state === "needs_review" || state === "not_started" ||
    (state === "verified" && face.method === "admin_review");

  return (
    <section className="bg-white border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-lg">Face Verification</h2>
        <StateBadge user={user} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Info label="Result" value={face.result} />
        <Info label="Method" value={METHODS[face.method] || face.method} />
        <Info label="Match score" value={score == null ? "N/A" : `${formatScore(score)} (pass ≥ ${formatScore(threshold)})`} />
        <Info label="Provider" value={PROVIDERS[face.provider] || face.provider} />
        <Info label="Last checked" value={formatDate(face.checkedAt)} />
        <Info label="Verified at" value={formatDate(face.verifiedAt)} />
        {face.reviewedAt && <Info label="Reviewed by" value={`${face.reviewedByName || face.reviewedBy} on ${formatDate(face.reviewedAt)}`} />}
        {face.reviewNote && <Info label="Review note" value={face.reviewNote} />}
        <Info label="ID on file" value={idSubmission?.submitted ? "Yes" : "No"} />
      </div>
      <p className="text-xs text-gray-500">
        Scores come from the backend comparing the user's selfie with the front photo of their saved ID. The app cannot set them.
        Selfies that did not pass are kept for this review and are visible only to PRC admins.
      </p>
      <PhotoComparison
        selfieUrl={face.selfieImageUrl || latestReviewSelfie?.selfieImageUrl}
        selfieLabel={face.selfieImageUrl ? "Verified selfie" : latestReviewSelfie ? `Latest selfie (${faceAttemptLabel(latestReviewSelfie.outcome).toLowerCase()}, ${formatDate(latestReviewSelfie.createdAt)})` : "Selfie"}
        idUrl={idSubmission?.data?.frontIdImageUrl}
        loading={attemptsLoading}
      />

      <div>
        <h3 className="font-semibold text-sm mb-2">Attempt history</h3>
        {attemptsLoading ? <p className="text-sm text-gray-500">Loading attempts...</p>
          : attemptsError ? <p role="alert" className="text-sm text-red-700">{attemptsError}</p>
          : attempts.length === 0 ? <p className="text-sm text-gray-500">No attempts yet.</p>
          : (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 text-left">
                  <tr><th className="p-2">Selfie</th><th className="p-2">When</th><th className="p-2">Outcome</th><th className="p-2">Score</th><th className="p-2">Counted</th><th className="p-2">HTTP</th></tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.id} className="border-t">
                      <td className="p-2">
                        {attempt.selfieImageUrl
                          ? <a href={attempt.selfieImageUrl} target="_blank" rel="noreferrer noopener" title="Open full size"><img src={attempt.selfieImageUrl} alt="Attempt selfie" className="w-10 h-10 rounded-lg border object-cover" referrerPolicy="no-referrer" /></a>
                          : <span className="text-xs text-gray-400">{attempt.reviewUploadError ? "Not saved" : "—"}</span>}
                      </td>
                      <td className="p-2 whitespace-nowrap">{formatDate(attempt.createdAt)}</td>
                      <td className="p-2">{faceAttemptLabel(attempt.outcome)}</td>
                      <td className="p-2">{formatScore(attempt.score)}</td>
                      <td className="p-2">{attempt.counted ? "Yes" : "No"}</td>
                      <td className="p-2">{display(attempt.httpStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <p className="text-xs text-gray-500 mt-2">Users get 5 counted attempts per day (Philippine time). Server errors and ID problems are not counted.</p>
      </div>

      {(canApprove || canReject) && (
        <div className="border-t pt-4 space-y-3">
          <h3 className="font-semibold text-sm">PRC review</h3>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={300}
            placeholder="Note (required to reject), e.g. confirmed identity by phone"
            className="w-full border rounded-lg p-2 text-sm" />
          {reviewError && <p role="alert" className="text-sm text-red-700">{reviewError}</p>}
          <div className="flex flex-wrap gap-2">
            {canApprove && (
              <button type="button" disabled={busy || !idSubmission?.submitted} onClick={() => review(true)}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                {busy ? "Saving..." : "Approve identity"}
              </button>
            )}
            {canReject && (
              <button type="button" disabled={busy} onClick={() => review(false)}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
                Reject
              </button>
            )}
          </div>
          {canApprove && !idSubmission?.submitted && <p className="text-xs text-gray-500">The user must upload a valid ID before PRC can approve them.</p>}
        </div>
      )}
    </section>
  );
}

function DeleteAccount({ user, onDeleted }) {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // PRC types the email (or DELETE when there is none) to confirm.
  const expected = user.email || "DELETE";
  const name = user.fullName || user.name || user.email || "this user";

  const close = () => { if (!busy) { setOpen(false); setTyped(""); setError(""); } };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await deleteUserAccount(user.uid, currentUser);
      onDeleted(user, result);
    } catch (err) {
      setError(err.message || "Could not delete the account.");
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-rose-200 rounded-2xl p-5 space-y-3">
      <h2 className="font-bold text-lg text-rose-800">Delete Account</h2>
      <p className="text-sm text-gray-600">
        Removes the account the same way as Delete Account in the mobile app: in-progress blood requests are
        cancelled, active donor offers withdrawn, uploaded photos, personal records and chats deleted, and the
        sign-in removed. Fulfilled and closed requests and donations stay as PRC records.
      </p>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
        <LuTrash2 /> Delete account
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Delete {name}'s account?</h3>
            <p className="text-sm text-gray-600">This cannot be undone. The user will need to register again to use Blood-Connect.</p>
            <label className="block text-sm text-gray-700">
              Type <span className="font-mono font-semibold">{expected}</span> to confirm
              <input value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} autoFocus
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500" />
            </label>
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={close} disabled={busy}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={confirm} disabled={busy || typed.trim() !== expected}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl disabled:opacity-50">
                {busy ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [idSubmission, setIdSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const records = await getUsers();
      const people = records.filter((user) => user.role !== "admin");
      setUsers(people);
      return people;
    } catch (err) {
      setError(err.message || "Could not load users.");
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Initial load; state is only set once the request settles.
  useEffect(() => {
    let active = true;
    getUsers()
      .then((records) => { if (active) setUsers(records.filter((user) => user.role !== "admin")); })
      .catch((err) => { if (active) setError(err.message || "Could not load users."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => {
    const result = { all: users.length };
    for (const user of users) {
      const state = faceReviewState(user);
      result[state] = (result[state] || 0) + 1;
    }
    return result;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.toLowerCase().trim();
    return users.filter((user) =>
      (filter === "all" || faceReviewState(user) === filter) &&
      [user.fullName, user.name, user.email, user.uid, user.phoneNumber]
        .some((value) => String(value ?? "").toLowerCase().includes(term))
    );
  }, [users, search, filter]);

  const openUser = async (user) => {
    setSelectedUser(user);
    setIdSubmission(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const result = await getUserIdSubmission(user.uid);
      setIdSubmission(result);
    } catch (err) {
      setDetailError(err.message || "Could not load ID submission status.");
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshSelected = async () => {
    const people = await loadUsers();
    const updated = people.find((user) => user.uid === selectedUser?.uid);
    if (updated) setSelectedUser(updated);
  };

  const handleDeleted = (user, result) => {
    setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
    setSelectedUser(null);
    setIdSubmission(null);
    const s = result?.summary || {};
    setNotice(
      `Deleted ${user.fullName || user.name || user.email || "the account"}. ` +
      `${s.requestsCancelled || 0} request(s) cancelled, ${s.offersWithdrawn || 0} offer(s) withdrawn.`
    );
  };

  if (selectedUser) {
    const user = selectedUser;
    const address = [user.purok, user.barangay, user.municipality, user.province].filter(Boolean).join(", ");
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        <button type="button" onClick={() => { setSelectedUser(null); setIdSubmission(null); }} className="flex items-center gap-2 text-sm text-gray-700 hover:text-red-700"><LuArrowLeft /> Back to Users</button>
        <div><h1 className="text-2xl font-bold text-gray-900">User Profile</h1><p className="text-sm text-gray-500">Registered account information</p></div>
        <section className="bg-white border rounded-2xl p-5 space-y-4">
          <h2 className="font-bold text-lg">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Info label="Full Name" value={user.fullName || user.name} />
            <Info label="Email" value={user.email} />
            <Info label="Phone" value={user.phoneNumber} />
            <Info label="Birth Date" value={formatDate(user.birthDate || user.birthday)} />
            <Info label="Blood Type" value={user.bloodType} />
            <Info label="Role" value={user.role || "user"} />
            <Info label="Address" value={address} />
            <Info label="Profile" value={user.profileCompleted ? "Completed" : "Incomplete"} />
          </div>
        </section>
        <section className="bg-white border rounded-2xl p-5 space-y-4">
          <h2 className="font-bold text-lg">ID Submission</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Info label="ID Submission" value={detailLoading ? "Loading..." : detailError ? "Unable to load" : idSubmission?.submitted ? "Submitted" : idSubmission?.status === "incomplete" ? "Incomplete record" : "Not submitted"} />
            <Info label="ID Type" value={idSubmission?.data?.idType} />
            <Info label="ID Submitted At" value={formatDate(idSubmission?.data?.submittedAt || idSubmission?.data?.createdAt)} />
          </div>
          {detailError && <p role="alert" className="text-sm text-red-700">{detailError}</p>}
          <p className="text-xs text-gray-500">ID submission records that photos were provided. It does not mean PRC approved the user's donor application or blood request.</p>
          {idSubmission?.submitted && <p className="text-sm text-gray-600">ID photos are saved for authorized review in donor and blood-request workflows. They are not displayed in this general user directory.</p>}
        </section>
        <FaceReview key={user.uid} user={user} idSubmission={idSubmission} onReviewed={refreshSelected} />
        <section className="bg-white border rounded-2xl p-5 space-y-3">
          <h2 className="font-bold text-lg">Account Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Info label="User ID" value={user.uid} />
            <Info label="Account Status" value={user.status || "N/A"} />
            <Info label="Created" value={formatDate(user.createdAt)} />
            <Info label="Last Updated" value={formatDate(user.updatedAt)} />
          </div>
        </section>
        <DeleteAccount key={`delete-${user.uid}`} user={user} onDeleted={handleDeleted} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Registered Users</h1><p className="text-sm text-gray-500">Manage accounts and review identity verification</p></div>
        <button type="button" onClick={loadUsers} disabled={loading} className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"><LuRefreshCw /> Refresh</button>
      </div>
      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          <span className="flex items-center gap-2"><LuCheck /> {notice}</span>
          <button type="button" onClick={() => setNotice("")} className="text-emerald-700 font-semibold">Dismiss</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by verification">
        {FILTERS.map(({ key, label }) => (
          <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-sm border ${filter === key ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
            {label} <span className="opacity-75">({counts[key] || 0})</span>
          </button>
        ))}
      </div>
      <div className="bg-white border rounded-xl p-3 flex items-center gap-2"><LuSearch className="text-gray-400" /><input className="w-full outline-none text-sm" placeholder="Search by name, email, phone or UID" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
      {loading ? <p className="text-sm text-gray-500">Loading users...</p> : (
        <div className="bg-white border rounded-2xl overflow-hidden">
          {filteredUsers.length === 0 ? <p className="p-6 text-sm text-gray-500">No users found.</p> : filteredUsers.map((user) => (
            <button type="button" key={user.uid} onClick={() => openUser(user)} className="w-full text-left p-4 border-b last:border-b-0 hover:bg-gray-50 flex items-center justify-between gap-4">
              <div className="min-w-0"><p className="font-semibold text-gray-900 truncate">{user.fullName || user.name || "Unnamed user"}</p><p className="text-xs text-gray-500 truncate">{user.email || user.uid}</p></div>
              <div className="flex items-center gap-3 shrink-0"><StateBadge user={user} /><span className="text-xs text-red-700 font-medium">View profile →</span></div>
            </button>
          ))}
        </div>
      )}
      {!loading && <p className="text-xs text-gray-500">Showing {filteredUsers.length} of {users.length} users</p>}
    </div>
  );
}
