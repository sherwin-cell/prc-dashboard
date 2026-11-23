import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

// "collection/id" -> Promise<data | null>, shared by every caller in this tab.
const loaded = new Map();

function loadDoc(collectionName, id) {
  const key = `${collectionName}/${id}`;
  if (!loaded.has(key)) {
    loaded.set(
      key,
      getDoc(doc(db, collectionName, id))
        .then((snap) => (snap.exists() ? { id: snap.id, ...snap.data() } : null))
        .catch((error) => {
          console.error(`Could not load ${key}:`, error);
          loaded.delete(key); // retry next time
          return null;
        })
    );
  }
  return loaded.get(key);
}

/**
 * One-time reads of collectionName/{id} for the given ids (cached for the
 * tab). Returns { [id]: data | null }; ids still loading are absent.
 */
export function useDocsById(collectionName, ids) {
  const key = useMemo(() => [...new Set(ids.filter(Boolean))].sort().join("|"), [ids]);
  const [docs, setDocs] = useState({});

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    Promise.all(key.split("|").map((id) => loadDoc(collectionName, id).then((data) => [id, data]))).then(
      (entries) => {
        if (active) setDocs((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
      }
    );
    return () => {
      active = false;
    };
  }, [collectionName, key]);

  return docs;
}

/** users/{uid} profiles (names, municipality) for the given ids. */
export const useUserProfiles = (ids) => useDocsById("users", ids);
