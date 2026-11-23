import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

/** Live number of blood requests waiting for PRC review (null while loading). */
export function usePendingRequestCount() {
  const [count, setCount] = useState(null);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "blood_requests"), where("status", "==", "pending")),
        (snapshot) => setCount(snapshot.docs.filter((d) => d.data().archived !== true).length),
        (error) => console.error("Could not count pending requests:", error)
      ),
    []
  );

  return count;
}
