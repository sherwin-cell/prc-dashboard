import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();

  // 1. Wait until Firebase finishes checking the session
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-600">Loading admin session...</p>
      </div>
    );
  }

  // 2. Only redirect if loading is finished AND there is no user
  if (!currentUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ error: "Please log in with an authorized admin account." }}
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;