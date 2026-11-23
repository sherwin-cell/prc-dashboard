import { useState } from "react";
import { LuPackageCheck, LuX } from "react-icons/lu";
import { RequestStatus, unitsNeededOf } from "../../constants/statuses";
import { notifyPrcStock } from "../../services/prcStockService";

const DEFAULT_INSTRUCTIONS =
  "Claim the reserved blood at the PRC Sorsogon Chapter blood bank. " +
  "Bring a valid ID and the original Blood Request Form signed by the physician.";

const chatTextFor = (request, units, instructions) =>
  `Good news: PRC Sorsogon has reserved ${units} unit${units === 1 ? "" : "s"} of ` +
  `${request.bloodType || "blood"}${request.component ? ` (${request.component})` : ""} ` +
  `for ${request.patientName || "your patient"}. ${instructions}`;

/**
 * "Notify: Blood Available at PRC". The backend records the reservation,
 * notifies the requester (in-app + push) and optionally posts in their PRC
 * Support chat. On a pending request this is also PRC's approval.
 */
export default function PrcStockModal({ request, adminUser, onClose, onDone }) {
  const needed = unitsNeededOf(request);
  const previous = request.prcStock || {};
  const [units, setUnits] = useState(Number(previous.reservedUnits) || needed);
  const [instructions, setInstructions] = useState(previous.pickupInstructions || DEFAULT_INSTRUCTIONS);
  const [sendChat, setSendChat] = useState(true);
  // null = follow the units and instructions; a string once PRC edits it.
  const [chatEdit, setChatEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const chatText = chatEdit ?? chatTextFor(request, units, instructions.trim());
  const pending = (request.status || RequestStatus.pending) === RequestStatus.pending;
  const remaining = needed - units;
  const unitsValid = Number.isInteger(units) && units >= 1 && units <= needed;
  const instructionsValid = instructions.trim().length >= 10;

  const submit = async (event) => {
    event.preventDefault();
    if (!unitsValid || !instructionsValid || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await notifyPrcStock(
        request.id,
        { reservedUnits: units, pickupInstructions: instructions.trim(), chatMessage: sendChat ? chatText.trim() : null },
        adminUser
      );
      onDone(result);
    } catch (err) {
      setError(err.message || "Could not notify the requester.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="prc-stock-title">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-700">
              <LuPackageCheck size={18} />
            </span>
            <div>
              <h3 id="prc-stock-title" className="text-base font-bold text-gray-900">Notify: Blood Available at PRC</h3>
              <p className="text-xs text-gray-500">
                {request.patientName || "Patient"} · {request.bloodType} · {needed} unit{needed === 1 ? "" : "s"} requested
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
            <LuX size={18} />
          </button>
        </div>

        {previous.reservedUnits && (
          <p className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-900">
            The requester was already told about {previous.reservedUnits} reserved unit(s). Sending again replaces
            that with the details below and notifies them again.
          </p>
        )}

        <label className="block text-xs font-semibold text-gray-700">
          Reserved units
          <input
            type="number"
            min={1}
            max={needed}
            value={Number.isNaN(units) ? "" : units}
            onChange={(e) => setUnits(e.target.valueAsNumber)}
            className="mt-1 w-28 rounded-xl border border-gray-300 p-2 text-sm font-normal text-gray-900 focus:border-violet-500 focus:outline-none"
          />
          <span className="ml-2 font-normal text-gray-500">of {needed}</span>
          {!unitsValid && <span className="mt-1 block font-normal text-rose-700">Enter 1 to {needed}.</span>}
        </label>

        <label className="block text-xs font-semibold text-gray-700">
          PRC Sorsogon pickup instructions
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            maxLength={600}
            className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-xs font-normal text-gray-800 focus:border-violet-500 focus:outline-none"
          />
          <span className="mt-0.5 block text-right font-normal text-gray-400">{instructions.trim().length}/600</span>
          {!instructionsValid && <span className="block font-normal text-rose-700">Add at least a short instruction (10+ characters).</span>}
        </label>

        <div className="space-y-2 rounded-xl border border-gray-200 p-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <input type="checkbox" checked={sendChat} onChange={(e) => setSendChat(e.target.checked)} className="accent-violet-600" />
            Also send a message in Support Chats
          </label>
          {sendChat && (
            <>
              <textarea
                value={chatText}
                onChange={(e) => setChatEdit(e.target.value)}
                rows={4}
                maxLength={1000}
                aria-label="Support chat message"
                className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-800 focus:border-violet-500 focus:outline-none"
              />
              {chatEdit !== null && (
                <button type="button" onClick={() => setChatEdit(null)} className="text-[11px] font-semibold text-violet-700 hover:underline">
                  Reset to the suggested message
                </button>
              )}
            </>
          )}
        </div>

        <ul className="list-disc space-y-1 pl-5 text-[11px] text-gray-600">
          <li>The requester gets an in-app notification and a push on their phone.</li>
          {pending && <li><strong>This also approves the request</strong> (the review checklist is complete).</li>}
          {pending && unitsValid && (remaining > 0
            ? <li>The remaining {remaining} unit{remaining === 1 ? "" : "s"} will be opened to matching donors.</li>
            : <li>All units are covered, so donors will not be alerted.</li>)}
        </ul>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!unitsValid || !instructionsValid || busy}
            className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? "Sending..." : "Notify requester"}
          </button>
        </div>
      </form>
    </div>
  );
}
