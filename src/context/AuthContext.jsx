import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { AuthContext } from "./useAuth";

const accessDenied = (message) => {
  const error = new Error(message);
  error.code = "ACCESS_DENIED";
  return error;
};

/**
 * The admin profile for a signed-in Firebase user, or throws ACCESS_DENIED.
 *
 * Same test as isAdmin() in firestore.rules: the `admin` custom claim, or
 * users/{uid}.role == "admin". An account with only the claim may have no
 * users document, so its profile is built from the Auth account.
 */
const verifyAdmin = async (user) => {
  if (!user) return null;

  const [tokenResult, userSnap] = await Promise.all([
    user.getIdTokenResult(),
    getDoc(doc(db, "users", user.uid)),
  ]);
  const userData = userSnap.exists() ? userSnap.data() : null;
  const hasAdminClaim = tokenResult.claims.admin === true;

  if (hasAdminClaim || userData?.role === "admin") {
    return {
      fullName: user.displayName || user.email || "PRC Admin",
      email: user.email,
      ...(userData || {}),
      role: "admin",
      adminVia: hasAdminClaim ? "claim" : "role",
    };
  }

  throw accessDenied(
    userData
      ? "User is not authorized as an administrator."
      : "Admin profile not found in Firestore."
  );
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userData = await verifyAdmin(result.user);

      setCurrentUser(result.user);
      setAdminProfile(userData);
      return result;
    } catch (error) {
      console.error("Admin login failed:", error);

      // A signed-in account that is not an admin is signed out again.
      if (error.code === "ACCESS_DENIED") {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error("Failed to sign out unauthorized user:", signOutError);
        }

        setCurrentUser(null);
        setAdminProfile(null);
      }

      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setAdminProfile(null);
  };

  // Re-check admin access whenever the app starts or Firebase restores a session.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setAdminProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userData = await verifyAdmin(user);
        setCurrentUser(user);
        setAdminProfile(userData);
      } catch (error) {
        console.error("Admin authorization failed:", error);
        setCurrentUser(null);
        setAdminProfile(null);

        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error("Failed to sign out unauthorized user:", signOutError);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = {
    currentUser,
    adminProfile,
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
