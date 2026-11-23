import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { LuMousePointerClick } from "react-icons/lu";
import { db } from "../../firebase/config";
import BloodRequestsPage from "./BloodRequestsPage";
import BloodRequestDetail from "./BloodRequestDetail";
import { QUEUE_TABS, matchesSearch, queueTabOf, sortForTab, userNameOf } from "./requestQueue";
import { useUserProfiles } from "./useUserProfiles";

const TAB_IDS = QUEUE_TABS.map((t) => t.id);

/**
 * Blood Requests workspace: the queue (left, ~32%) and the selected request
 * (right, ~68%). The tab and the selected request are kept in the URL
 * (?tab=pending&request=ID) so a request can be linked to and survives reloads.
 */
const ParentBloodRequestsManager = () => {
  const [params, setParams] = useSearchParams();
  const tab = TAB_IDS.includes(params.get("tab")) ? params.get("tab") : "pending";
  const selectedId = params.get("request");

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [bloodType, setBloodType] = useState("");

  // Live, so approvals, PRC stock notices, cancellations from the app and
  // archive/restore move requests between tabs without a reload.
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "blood_requests"), orderBy("createdAt", "desc")),
        (snapshot) => {
          setRequests(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          setError("");
          setLoading(false);
        },
        (err) => {
          console.error("Error loading blood requests:", err);
          setError("Could not load blood requests. Check your connection and admin access.");
          setLoading(false);
        }
      ),
    []
  );

  const requesterIds = useMemo(() => requests.map((r) => r.requesterId || r.userId), [requests]);
  const profiles = useUserProfiles(requesterIds);
  const nameOf = (request) => userNameOf(profiles[request.requesterId || request.userId]);

  const counts = useMemo(() => {
    const result = Object.fromEntries(TAB_IDS.map((id) => [id, 0]));
    for (const request of requests) result[queueTabOf(request)] += 1;
    return result;
  }, [requests]);

  const items = sortForTab(
    requests.filter(
      (request) =>
        queueTabOf(request) === tab &&
        (!bloodType || request.bloodType === bloodType) &&
        matchesSearch(request, search, nameOf(request))
    ),
    tab
  ).map((request) => ({ request, requesterName: nameOf(request) }));

  const selected = requests.find((r) => r.id === selectedId) || null;

  const update = (changes) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[560px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm">
      {/* Below lg the queue and the details take turns. */}
      <div
        className={`w-full shrink-0 border-r border-gray-200 lg:block lg:w-[32%] lg:min-w-[300px] ${
          selected ? "hidden" : "block"
        }`}
      >
        <BloodRequestsPage
          items={items}
          counts={counts}
          tab={tab}
          onTabChange={(id) => update({ tab: id })}
          search={search}
          onSearchChange={setSearch}
          bloodType={bloodType}
          onBloodTypeChange={setBloodType}
          selectedId={selectedId}
          onSelect={(id) => update({ request: id })}
          loading={loading}
          error={error}
        />
      </div>

      <div className={`min-w-0 flex-1 ${selected ? "block" : "hidden lg:block"}`}>
        {selected ? (
          <BloodRequestDetail
            key={selected.id}
            request={selected}
            requester={profiles[selected.requesterId || selected.userId] || null}
            onBack={() => update({ request: null })}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-gray-400">
            <LuMousePointerClick size={28} />
            {selectedId && !loading
              ? "This request no longer exists. It may have been deleted."
              : "Select a request from the queue to review it."}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentBloodRequestsManager;
