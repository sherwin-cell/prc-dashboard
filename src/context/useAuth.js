import { createContext, useContext } from "react";

/** Holds { currentUser, adminProfile, login, logout, loading }; see AuthProvider. */
export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
