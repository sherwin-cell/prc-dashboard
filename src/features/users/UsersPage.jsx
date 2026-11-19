import React, { useEffect, useMemo, useState } from "react";
import { LuArrowLeft, LuSearch, LuRefreshCw } from "react-icons/lu";
import { getUsers, getUserIdSubmission } from "../../services/firestore/userService";

const display = (value) => value === null || value === undefined || value === "" ? "N/A" : String(value);
const formatDate = (value) => {
  if (!value) return "N/A";
  try {
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  } catch { return "N/A"; }
};

function Info({ label, value }) {
  return <div><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900 break-words">{display(value)}</p></div>;
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

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const records = await getUsers();
      setUsers(records.filter((user) => user.role !== "admin"));
    } catch (err) {
      setError(err.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const filteredUsers = useMemo(() => {
    const term = search.toLowerCase().trim();
    return users.filter((user) =>
      [user.fullName, user.name, user.email, user.uid, user.phoneNumber]
        .some((value) => String(value ?? "").toLowerCase().includes(term))
    );
  }, [users, search]);

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

  if (selectedUser) {
    const user = selectedUser;
    const face = user.faceVerification || {};
    const address = [user.purok, user.barangay, user.municipality, user.province].filter(Boolean).join(", ");
    const facePassed = face.faceMatchPassed === true || face.verificationResult === "verified";
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
          <h2 className="font-bold text-lg">Verification Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Info label="Face Check" value={facePassed ? "Passed (app-reported)" : "Not passed / unavailable"} />
            <Info label="Face Detection" value={face.hasDetectedFace === true ? "Detected" : "Not available"} />
            <Info label="Face Match Confidence" value={face.faceMatchConfidence == null ? "N/A" : face.faceMatchConfidence} />
            <Info label="Face Verification Date" value={formatDate(face.verifiedAt)} />
            <Info label="ID Submission" value={detailLoading ? "Loading..." : detailError ? "Unable to load" : idSubmission?.submitted ? "Submitted" : idSubmission?.status === "incomplete" ? "Incomplete record" : "Not submitted"} />
            <Info label="ID Type" value={idSubmission?.data?.idType} />
            <Info label="ID Submitted At" value={formatDate(idSubmission?.data?.submittedAt || idSubmission?.data?.createdAt)} />
          </div>
          {detailError && <p role="alert" className="text-sm text-red-700">{detailError}</p>}
          <p className="text-xs text-gray-500">ID submission records that photos were provided. It does not mean PRC approved the user's identity, donor application, or blood request.</p>
          {face.selfieImageUrl && (
            <div><p className="text-xs text-gray-500 mb-2">Face verification selfie</p><img src={face.selfieImageUrl} alt="Verification selfie" className="w-32 h-32 rounded-xl border object-cover" referrerPolicy="no-referrer" /></div>
          )}
          {idSubmission?.submitted && <p className="text-sm text-gray-600">ID photos are saved for authorized review in donor and blood-request workflows. They are not displayed in this general user directory.</p>}
        </section>
        <section className="bg-white border rounded-2xl p-5 space-y-3">
          <h2 className="font-bold text-lg">Account Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Info label="User ID" value={user.uid} />
            <Info label="Account Status" value={user.status || "N/A"} />
            <Info label="Created" value={formatDate(user.createdAt)} />
            <Info label="Last Updated" value={formatDate(user.updatedAt)} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Registered Users</h1><p className="text-sm text-gray-500">Manage and view registered Blood-Connect accounts</p></div>
        <button type="button" onClick={loadUsers} disabled={loading} className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"><LuRefreshCw /> Refresh</button>
      </div>
      <div className="bg-white border rounded-xl p-3 flex items-center gap-2"><LuSearch className="text-gray-400" /><input className="w-full outline-none text-sm" placeholder="Search by name, email, phone or UID" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
      {loading ? <p className="text-sm text-gray-500">Loading users...</p> : (
        <div className="bg-white border rounded-2xl overflow-hidden">
          {filteredUsers.length === 0 ? <p className="p-6 text-sm text-gray-500">No users found.</p> : filteredUsers.map((user) => (
            <button type="button" key={user.uid} onClick={() => openUser(user)} className="w-full text-left p-4 border-b last:border-b-0 hover:bg-gray-50 flex items-center justify-between gap-4">
              <div className="min-w-0"><p className="font-semibold text-gray-900 truncate">{user.fullName || user.name || "Unnamed user"}</p><p className="text-xs text-gray-500 truncate">{user.email || user.uid}</p></div>
              <span className="text-xs text-red-700 font-medium shrink-0">View profile →</span>
            </button>
          ))}
        </div>
      )}
      {!loading && <p className="text-xs text-gray-500">Showing {filteredUsers.length} of {users.length} users</p>}
    </div>
  );
}
