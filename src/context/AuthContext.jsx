import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Verify that a Firebase user has an admin profile
   * in Firestore.
   */
  const verifyAdmin = async (user) => {
    if (!user) {
      return null;
    }

    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      const error = new Error(
        "Admin profile not found in Firestore."
      );
      error.code = "ACCESS_DENIED";
      throw error;
    }

    const userData = userSnap.data();

    if (userData?.role !== "admin") {
      const error = new Error(
        "User is not authorized as an administrator."
      );
      error.code = "ACCESS_DENIED";
      throw error;
    }

    return userData;
  };

  /**
   * Login
   */
  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const user = result.user;

      console.log("========== ADMIN LOGIN ==========");
      console.log("Email:", user.email);
      console.log("UID:", user.uid);

      const userData = await verifyAdmin(user);

      setCurrentUser(user);
      setAdminProfile(userData);

      console.log("Admin profile:", userData);
      console.log("ADMIN LOGIN SUCCESS");
      console.log("================================");

      return result;
    } catch (error) {
      console.error("Admin login failed:", error);

      // If the Firebase account is not authorized,
      // make sure it is signed out.
      if (error.code === "ACCESS_DENIED") {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error(
            "Failed to sign out unauthorized user:",
            signOutError
          );
        }

        setCurrentUser(null);
        setAdminProfile(null);
      }

      throw error;
    }
  };

  /**
   * Logout
   */
  const logout = async () => {
    try {
      await signOut(auth);

      setCurrentUser(null);
      setAdminProfile(null);

      console.log("Admin logged out.");
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  };

  /**
   * Monitor Firebase authentication state.
   *
   * This also verifies the Firestore admin role whenever
   * the application starts or Firebase restores a session.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setAdminProfile(null);
        setLoading(false);
        return;
      }

      try {
        console.log("========== AUTH STATE ==========");
        console.log("Email:", user.email);
        console.log("UID:", user.uid);

        const userData = await verifyAdmin(user);

        setCurrentUser(user);
        setAdminProfile(userData);

        console.log("Authorized admin detected.");
        console.log("Role:", userData?.role);
        console.log("================================");
      } catch (error) {
        console.error(
          "Admin authorization failed:",
          error
        );

        setCurrentUser(null);
        setAdminProfile(null);

        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error(
            "Failed to sign out unauthorized user:",
            signOutError
          );
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
