import { useMemo, useState } from "react";
import { db } from "../../firebase/config";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import {
  LuArchive,
  LuBan,
  LuBellRing,
  LuCheck,
  LuCircleCheck,
  LuClipboardCheck,
  LuHistory,
  LuPackageCheck,
  LuRotateCcw,
  LuShieldCheck,
  LuTrash2,
} from "react-icons/lu";
import { useAuth } from "../../context/useAuth";
import RequestOffersList from "../../components/admin/RequestOffersList";
import DocumentViewer from "../../components/common/DocumentViewer";
import {
  archiveRequest,
  deleteRequest,
  markRequestFulfilled,
  restoreRequest,
  saveReviewChecklistItem,
} from "../../services/firestore/requestService";
import {
  RequestStatus,
  canArchiveRequest,
  isRequestArchived,
  isRequestOpen,
  requestStatusClasses,
  requestStatusLabel,
  unitsNeededOf,
} from "../../constants/statuses";
import PrcStockModal from "./PrcStockModal";
import {
  formatDate,
  neededByOf,
  prcStockNoticesOf,
  requirementLabel,
  reservedUnitsOf,
  showsUrgency,
  urgencyOf,
  userNameOf,
} from "./requestQueue";
import { requestTimeline } from "./requestTimeline";
import { useUserProfiles } from "./useUserProfiles";

const CONFIRM_COPY = {
  approve: { title: "Approve request", verb: "approve", button: "Yes, approve", color: "bg-emerald-600 hover:bg-emerald-700" },
  reject: { title: "Reject request", verb: "reject", button: "Yes, reject", color: "bg-rose-600 hover:bg-rose-700" },
  fulfill: { title: "Mark request fulfilled", verb: "mark as fulfilled", button: "Yes, mark fulfilled", color: "bg-blue-600 hover:bg-blue-700" },
  archive: { title: "Archive request", verb: "archive", button: "Yes, archive", color: "bg-amber-600 hover:bg-amber-700" },
  restore: { title: "Restore request", verb: "restore", button: "Yes, restore", color: "bg-gray-900 hover:bg-black" },
  delete: { title: "Delete request", verb: "permanently delete", button: "Yes, delete", color: "bg-rose-600 hover:bg-rose-700" },
};

// reviewChecklist.{id} on the request (admin-only; see firestore.rules).
const CHECKLIST = [
  { id: "brfMatches", label: "BRF matches patient & hospital", hint: "Name, hospital and blood need on the form agree with the typed fields." },
  { id: "physicianVerified", label: "Physician & license verified", hint: "The requesting physician's name and PRC license number are on the BRF." },
  { id: "idMatches", label: "ID matches requester", hint: "The ID photos show the account holder who submitted the request." },
];

const TONES = {
  gray: "bg-gray-400",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
};

const hemoglobinLabel = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "Not given";
  // A bare number is hemoglobin in g/dL; anything else is shown as typed.
  return /^\d+(\.\d+)?$/.test(text) ? `${text} g/dL` : text;
};

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
    <dd className="mt-0.5 break-words text-xs font-medium text-gray-900">{children || <span className="text-gray-400">N/A</span>}</dd>
  </div>
);

const Card = ({ title, icon, children, className = "" }) => (
  <section className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-xs ${className}`}>
    <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
      {icon}
      {title}
    </h3>
    {children}
  </section>
);

// wide: the inspector is expanded to the full workspace (documents beside the fields).
const BloodRequestDetail = ({ request: reqData, requester, onBack, wide = false }) => {
  const { currentUser } = useAuth();
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejectionReason, setRejectionReason] = useState(""); // shown to the requester in the app
  const [confirm, setConfirm] = useState(null); // CONFIRM_COPY key
  const [busy, setBusy] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [savingItem, setSavingItem] = useState("");

  const status = reqData.status || RequestStatus.pending;
  const isPending = status === RequestStatus.pending;
  const archived = isRequestArchived(reqData);
  const open = isRequestOpen(status) && !archived;
  const units = unitsNeededOf(reqData);
  const reserved = reservedUnitsOf(reqData);
  const urgency = urgencyOf(reqData);
  const id = reqData.idVerification || {};
  const hasIdPhotos = Boolean(id.frontIdImageUrl || id.backIdImageUrl);
  const requesterName = userNameOf(requester) || "Unknown requester";

  const checklist = reqData.reviewChecklist || {};
  const requiredItems = CHECKLIST.filter((item) => item.id !== "idMatches" || hasIdPhotos);
  const checklistDone = requiredItems.every((item) => checklist[item.id] === true);

  const timeline = useMemo(() => requestTimeline(reqData), [reqData]);
  const actorIds = useMemo(() => timeline.map((e) => e.actorId), [timeline]);
  const actors = useUserProfiles(actorIds);
  const actorName = (uid) => {
    if (!uid) return "";
    if (uid === currentUser?.uid) return "you";
    return userNameOf(actors[uid]) || (uid === (reqData.requesterId || reqData.userId) ? "the requester" : "PRC admin");
  };

  const flash = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 5000);
  };

  const toggleChecklist = async (item, checked) => {
    setSavingItem(item);
    setActionError("");
    try {
      await saveReviewChecklistItem(reqData.id, item, checked, currentUser);
    } catch (error) {
      setActionError(error.message || "Could not save the checklist.");
    } finally {
      setSavingItem("");
    }
  };

  const review = async (actionType) => {
    if (reqData.status !== RequestStatus.pending) {
      throw new Error(`This request is "${requestStatusLabel(reqData.status)}" and can no longer be reviewed.`);
    }
    const reason = rejectionReason.trim();
    if (actionType === "reject" && !reason) throw new Error("Enter a reason for the requester before rejecting.");
    if (actionType === "approve" && !checklistDone) throw new Error("Complete the review checklist before approving.");

    // A published (PRC-approved) blood request is "active"; the ID
    // verification submission keeps its own approved/rejected status.
    const newStatus = actionType === "approve" ? RequestStatus.active : RequestStatus.rejected;
    const batch = writeBatch(db);
    batch.update(doc(db, "blood_requests", reqData.id), {
      status: newStatus,
      // The backend times the approval/rejection notice from reviewedAt.
      reviewedAt: serverTimestamp(),
      reviewedBy: currentUser?.uid || "admin",
      ...(actionType === "reject" ? { rejectionReason: reason } : {}),
      updatedAt: serverTimestamp(),
    });

    // Anonymized summary shown to donors (no patient identity, requester
    // contact details or Blood Request Form). Only for published requests.
    if (actionType === "approve") {
      batch.set(doc(db, "request_summaries", reqData.id), {
        requestId: reqData.id,
        bloodType: reqData.bloodType ?? null,
        component: reqData.component ?? null,
        unitsRequired: reqData.unitsRequired ?? null,
        urgency: reqData.urgency ?? null,
        // The hospital is shown to donors; the patient stays anonymous.
        hospitalName: reqData.hospitalName ?? null,
        neededByDate: reqData.neededByDate ?? reqData.neededBy ?? reqData.requiredDate ?? null,
        status: RequestStatus.active,
        createdAt: reqData.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (reqData.idVerificationSubmissionId) {
      batch.update(doc(db, "id_verifications", reqData.idVerificationSubmissionId), {
        status: actionType === "approve" ? "approved" : "rejected",
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    setRejectionReason("");
    return actionType === "approve" ? "Request approved. Matching donors are being alerted." : "Request rejected. The requester sees your reason in the app.";
  };

  const runConfirmed = async () => {
    const action = confirm;
    if (!action) return;
    setBusy(true);
    setActionError("");
    try {
      let message;
      if (action === "approve" || action === "reject") {
        message = await review(action);
      } else {
        const run = { fulfill: markRequestFulfilled, archive: archiveRequest, restore: restoreRequest, delete: deleteRequest }[action];
        const result = await run(reqData.id, currentUser);
        if (!result.success) throw new Error(result.error || `Could not ${CONFIRM_COPY[action].verb} the request.`);
        message = {
          fulfill: `Marked fulfilled${result.declined ? `; ${result.declined} waiting offer(s) declined` : ""}.`,
          archive: "Request archived. It is in the Archived tab.",
          restore: "Request restored.",
          delete: "Request deleted.",
        }[action];
        if (action === "delete") {
          setConfirm(null);
          onBack();
          return;
        }
      }
      flash(message);
      setConfirm(null);
    } catch (error) {
      console.error(`Error (${action}) on request:`, error);
      setActionError(error.message || "Something went wrong.");
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const documents = [
    { id: "brf", label: "BRF PDF", type: "pdf", value: reqData.brfFileUrl },
    { id: "front", label: "Front ID", type: "image", value: id.frontIdImageUrl },
    { id: "back", label: "Back ID", type: "image", value: id.backIdImageUrl },
  ];

  const btn = "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const needsChecklist = isPending && !checklistDone;

  return (
    <div className="h-full overflow-y-auto">
      {/* Sticky header: who, what, where it stands, and what PRC can do. */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold text-gray-900">{reqData.patientName || "Unnamed patient"}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${requestStatusClasses(status)}`}>
                {requestStatusLabel(status)}
              </span>
              {archived && <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-[10px] font-bold uppercase text-gray-700">Archived</span>}
              {reserved > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-violet-800">
                  <LuPackageCheck size={11} /> PRC stock ready
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Requested by <span className="font-semibold text-gray-700">{requesterName}</span>
              {requester?.email ? ` · ${requester.email}` : ""} · submitted {formatDate(reqData.createdAt, true)}
            </p>
            <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-extrabold text-[#D32F2F]">
              {requirementLabel(reqData)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isPending && !archived && (
              <>
                <button className={`${btn} border border-rose-200 text-rose-700 hover:bg-rose-50`} onClick={() => setConfirm("reject")}>
                  Reject
                </button>
                <button
                  className={`${btn} bg-emerald-600 text-white shadow-xs hover:bg-emerald-700`}
                  disabled={needsChecklist}
                  title={needsChecklist ? "Complete the review checklist first" : undefined}
                  onClick={() => setConfirm("approve")}
                >
                  <LuCheck size={14} /> Approve
                </button>
              </>
            )}
            {(isPending || open) && !archived && (
              <button
                className={`${btn} bg-violet-600 text-white shadow-xs hover:bg-violet-700`}
                disabled={needsChecklist}
                title={needsChecklist ? "Complete the review checklist first" : "Tell the requester PRC has the blood"}
                onClick={() => setStockOpen(true)}
              >
                <LuPackageCheck size={14} /> Notify: Blood Available at PRC
              </button>
            )}
            {open && (
              <button className={`${btn} bg-blue-600 text-white shadow-xs hover:bg-blue-700`} onClick={() => setConfirm("fulfill")}>
                <LuCircleCheck size={14} /> Mark fulfilled
              </button>
            )}
            {!archived && canArchiveRequest(status) && (
              <button className={`${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`} onClick={() => setConfirm("archive")}>
                <LuArchive size={14} /> Archive
              </button>
            )}
            {archived && (
              <button className={`${btn} border border-gray-200 text-gray-700 hover:bg-gray-50`} onClick={() => setConfirm("restore")}>
                <LuRotateCcw size={14} /> Restore
              </button>
            )}
            {(archived || canArchiveRequest(status)) && (
              <button className={`${btn} text-gray-400 hover:bg-rose-50 hover:text-rose-700`} onClick={() => setConfirm("delete")} title="Delete request">
                <LuTrash2 size={14} />
              </button>
            )}
          </div>
        </div>
        {needsChecklist && !archived && (
          <p className="mt-2 text-[11px] text-amber-700">Complete the review checklist below to approve or reserve PRC stock.</p>
        )}
      </header>

      <div className="space-y-4 p-5">
        {notice && (
          <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
            <LuCheck size={16} className="shrink-0 text-emerald-600" /> {notice}
          </div>
        )}
        {actionError && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            <span>{actionError}</span>
            <button onClick={() => setActionError("")} className="font-bold text-rose-500 hover:text-rose-700">Dismiss</button>
          </div>
        )}
        {status === RequestStatus.cancelled && (
          <div role="status" className="flex items-start gap-2.5 rounded-2xl border border-gray-300 bg-gray-100 p-3 text-xs text-gray-800">
            <LuBan size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">The requester cancelled this request.</p>
              <p className="text-gray-600">No further PRC action is needed. Waiting donor offers can still be declined to close them out.</p>
            </div>
          </div>
        )}

        {/* Clinical summary strip */}
        <dl className={`grid gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 ${wide ? "grid-cols-5" : "grid-cols-2"}`}>
          {[
            ["Blood type", <span className="text-lg font-black text-[#D32F2F]">{reqData.bloodType || "?"}</span>],
            ["Units required", <span className="text-lg font-black tabular-nums text-gray-900">{units}</span>],
            ["Component", <span className="text-sm font-bold text-gray-900">{reqData.component || "Whole Blood"}</span>],
            ["Hgb / Hct (g/dL · %)", <span className="text-sm font-bold text-gray-900">{hemoglobinLabel(reqData.hemoglobin)}</span>],
            [
              "Target date needed",
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-bold text-gray-900">{neededByOf(reqData) ? formatDate(neededByOf(reqData)) : "Not set"}</span>
                {showsUrgency(reqData) && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${urgency.classes}`}>{urgency.label}</span>
                )}
              </span>,
            ],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-4 py-3">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
              <dd className="mt-1">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Review: typed fields and checklist beside the documents */}
        <div className={`grid gap-4 ${wide ? "grid-cols-2" : ""}`}>
          <div className="space-y-4">
            <Card title="Patient profile">
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Patient name">{reqData.patientName}</Field>
                <Field label="Age / sex">
                  {[reqData.patientAge && `${reqData.patientAge} yrs`, reqData.patientSex].filter(Boolean).join(" / ")}
                </Field>
                <Field label="Birthday">{reqData.patientBirthday}</Field>
                <Field label="Contact number">{reqData.contactNumber}</Field>
                <Field label="Relative / contact person">{reqData.relativeName}</Field>
                <Field label="Relationship">{reqData.relationship}</Field>
              </dl>
            </Card>

            <Card title="Hospital & physician information">
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Hospital">{reqData.hospitalName || reqData.hospital}</Field>
                <Field label="Clinical diagnosis">{reqData.clinicalDiagnosis}</Field>
                <Field label="Attending physician">{reqData.attendingPhysician}</Field>
                <Field label="Requesting physician & license">{reqData.requestingPhysician}</Field>
                <Field label="BRF date">{reqData.brfDate ? formatDate(reqData.brfDate) : null}</Field>
                <Field label="BRF file">{reqData.brfFileUrl ? reqData.brfFileName || "Blood Request Form.pdf" : null}</Field>
              </dl>
            </Card>

            <Card title="Review checklist" icon={<LuClipboardCheck size={14} />}>
              <ul className="space-y-2">
                {CHECKLIST.map((item) => {
                  const notApplicable = item.id === "idMatches" && !hasIdPhotos;
                  const checked = checklist[item.id] === true;
                  return (
                    <li key={item.id}>
                      <label className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${checked ? "border-emerald-200 bg-emerald-50/60" : "border-gray-200"} ${isPending && !notApplicable ? "cursor-pointer" : ""}`}>
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-emerald-600"
                          checked={checked}
                          disabled={!isPending || notApplicable || archived || savingItem === item.id}
                          onChange={(e) => toggleChecklist(item.id, e.target.checked)}
                        />
                        <span>
                          <span className="block text-xs font-semibold text-gray-900">{item.label}</span>
                          <span className="block text-[11px] text-gray-500">
                            {notApplicable ? "No ID photos are attached to this request, so this is not required." : item.hint}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {checklist.updatedAt && (
                <p className="mt-2 text-[10px] text-gray-400">
                  Last updated {formatDate(checklist.updatedAt, true)}
                  {checklist.updatedBy ? ` by ${actorName(checklist.updatedBy) || "PRC admin"}` : ""}
                </p>
              )}
              {!isPending && (
                <p className="mt-2 text-[10px] text-gray-400">Read-only: this request has already been reviewed.</p>
              )}
            </Card>

            {hasIdPhotos || reqData.idVerification ? (
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-blue-900">
                  <LuShieldCheck size={15} className="text-blue-600" />
                  {id.idType || "Government ID"}
                  {id.idNumber ? ` · ${id.idNumber}` : ""}
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                  {id.validationStatus || "submitted"}
                </span>
              </div>
            ) : (
              <p className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs italic text-gray-500">
                No identity verification is attached to this request.
              </p>
            )}
          </div>

          <div className={wide ? "sticky top-36 self-start" : ""}>
            <DocumentViewer documents={documents} />
          </div>
        </div>

        {(reqData.notes || reqData.otherInfo) && (
          <div className={`grid gap-3 ${wide ? "grid-cols-2" : ""}`}>
            {reqData.notes && (
              <div className="rounded-2xl border border-amber-200/60 bg-amber-50/70 p-3.5 text-xs">
                <strong className="block text-[10px] font-bold uppercase tracking-wider text-amber-900">Special notes</strong>
                <p className="mt-1 font-medium italic text-amber-950">"{reqData.notes}"</p>
              </div>
            )}
            {reqData.otherInfo && (
              <div className="rounded-2xl border border-gray-200 bg-white p-3.5 text-xs">
                <strong className="block text-[10px] font-bold uppercase tracking-wider text-gray-600">Other information</strong>
                <p className="mt-1 font-medium text-gray-900">{reqData.otherInfo}</p>
              </div>
            )}
          </div>
        )}

        {status === RequestStatus.rejected && (reqData.rejectionReason || reqData.adminNotes) && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-3.5 text-xs text-rose-900">
            <span className="font-bold">Reason shown to the requester:</span> {reqData.rejectionReason || reqData.adminNotes}
          </div>
        )}

        {reqData.prcStock && (
          <Card title="Blood reserved at PRC" icon={<LuPackageCheck size={14} className="text-violet-600" />} className="border-violet-200">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-xs text-gray-700">
              <span>
                <span className="text-2xl font-black tabular-nums text-violet-700">{reserved}</span> of {units} unit{units === 1 ? "" : "s"} reserved
              </span>
              <span>Requester notified {formatDate(reqData.prcStock.notifiedAt, true)}</span>
              <span>{reqData.prcStock.chatMessageSent ? "Support chat message sent" : "No support chat message"}</span>
            </div>
            <p className="mt-2 rounded-xl bg-violet-50 p-3 text-xs text-violet-950">{reqData.prcStock.pickupInstructions}</p>
          </Card>
        )}

        {/* Donors alerted on approval: matchingDonorsNotified, written by
            blood_connect_backend (notification worker); only a count. */}
        {!isPending && status !== RequestStatus.rejected && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900">
            <LuBellRing size={16} className="mt-0.5 shrink-0 text-blue-600" />
            {prcStockNoticesOf(reqData)[0]?.approvedRequest && reserved >= units ? (
              <p>PRC covered every unit from its own stock when approving, so no donors were alerted.</p>
            ) : typeof reqData.matchingDonorsNotified === "number" ? (
              reqData.matchingDonorsNotified > 0 ? (
                <p>
                  <span className="font-black tabular-nums">{reqData.matchingDonorsNotified}</span> matching donor
                  {reqData.matchingDonorsNotified === 1 ? "" : "s"} alerted when this request was approved.
                </p>
              ) : (
                <p>
                  <span className="font-bold">No matching donors were alerted.</span> Either the requester has no municipality or
                  province on their profile, or no available {reqData.bloodType || ""} donors live nearby. The request is still
                  listed for donors in the app.
                </p>
              )
            ) : (
              <p>
                Donor alerts not recorded yet. The backend notification worker records the count shortly after approval; if this
                stays empty, check that the backend is running.
              </p>
            )}
          </div>
        )}

        {!isPending && status !== RequestStatus.rejected && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
            <RequestOffersList requestId={reqData.id} requestStatus={status} unitsNeeded={units} />
          </section>
        )}

        <Card title="Activity timeline" icon={<LuHistory size={14} />}>
          {timeline.length === 0 ? (
            <p className="text-xs text-gray-400">No recorded activity yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-gray-200 pl-5">
              {timeline.map((event) => (
                <li key={event.key} className="relative">
                  <span className={`absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${TONES[event.tone]}`} />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-xs font-semibold text-gray-900">{event.title}</p>
                    <time className="text-[11px] tabular-nums text-gray-400" dateTime={event.at.toISOString()}>
                      {formatDate(event.at, true)}
                    </time>
                  </div>
                  {event.actorId && <p className="text-[11px] text-gray-500">by {actorName(event.actorId)}</p>}
                  {event.detail && <p className="mt-1 text-[11px] text-gray-600">{event.detail}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {stockOpen && (
        <PrcStockModal
          request={reqData}
          adminUser={currentUser}
          onClose={() => setStockOpen(false)}
          onDone={(result) => {
            setStockOpen(false);
            const parts = ["Requester notified that blood is available at PRC."];
            if (result.approved) parts.push(result.publishedToDonors ? "Request approved; the remaining units were opened to donors." : "Request approved.");
            if (!result.notificationCreated) parts.push("(They had already been notified of this exact notice.)");
            if (result.chatMessageSent) parts.push("Support chat message sent.");
            flash(parts.join(" "));
          }}
        />
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">{CONFIRM_COPY[confirm].title}</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to <span className="font-semibold">{CONFIRM_COPY[confirm].verb}</span> the blood request for{" "}
              <span className="font-semibold text-gray-900">{reqData.patientName || "this patient"}</span>?
            </p>
            {confirm === "reject" && (
              <label className="block text-xs font-semibold text-gray-700">
                Reason shown to the requester
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. The Blood Request Form is unreadable. Please submit a new request with a clear photo."
                  className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs font-normal text-gray-800 focus:border-rose-500 focus:outline-none"
                />
              </label>
            )}
            {confirm === "approve" && (
              <p className="text-xs text-gray-500">The request is published to matching donors and they are alerted.</p>
            )}
            {confirm === "fulfill" && (
              <p className="text-xs text-gray-500">
                Offers still waiting for PRC are declined automatically and those donors are told they were not needed. Confirmed
                donors stay, so you can still record their donations.
              </p>
            )}
            {confirm === "archive" && (
              <p className="text-xs text-gray-500">The requester keeps seeing its final status in the app. You can restore it from the Archived tab.</p>
            )}
            {confirm === "delete" && (
              <p className="text-xs text-gray-500">This permanently removes the request, its donor offers and its donor-facing summary. It cannot be undone.</p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setConfirm(null)} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={runConfirmed}
                disabled={busy || (confirm === "reject" && !rejectionReason.trim())}
                className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-xs disabled:opacity-50 ${CONFIRM_COPY[confirm].color}`}
              >
                {busy ? "Working..." : CONFIRM_COPY[confirm].button}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BloodRequestDetail;
