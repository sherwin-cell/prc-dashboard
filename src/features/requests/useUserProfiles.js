import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";

// uid -> Promise<profile | null>, shared by every caller in this tab.
const loaded = new Map();

function loadProfile(uid) {
  if (!loaded.has(uid)) {
    loaded.set(
      uid,
      getDoc(doc(db, "users", uid))
        .then((snap) => (snap.exists() ? { id: snap.id, ...snap.data() } : null))
        .catch((error) => {
          console.error("Could not load user profile:", error);
          loaded.delete(uid); // retry next time
          return null;
        })
    );
  }
  return loaded.get(uid);
}

/**
 * users/{uid} profiles for the given ids (requesters, reviewing admins).
 * Blood requests do not store the requester's name, so it is looked up here.
 * Returns { [uid]: profile | null }; ids still loading are absent.
 */
export function useUserProfiles(ids) {
  const key = useMemo(() => [...new Set(ids.filter(Boolean))].sort().join("|"), [ids]);
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    const wanted = key.split("|");
    Promise.all(wanted.map((uid) => loadProfile(uid).then((profile) => [uid, profile]))).then(
      (entries) => {
        if (active) setProfiles((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
      }
    );
    return () => {
      active = false;
    };
  }, [key]);

  return profiles;
}
