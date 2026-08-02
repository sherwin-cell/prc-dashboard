import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LuLock, LuMail, LuShieldAlert } from "react-icons/lu";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Pick up error message from redirected state (e.g. Access Denied)
  const redirectedError = location.state?.error;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Login failed:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Invalid admin credentials.");
      } else {
        setError("Failed to sign in. Check your internet connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
        
        {/* Header Header Brand */}
        <div className="bg-[#D32F2F] p-8 text-center text-white">
          <div className="w-16 h-16 bg-white text-[#D32F2F] rounded-full flex items-center justify-center text-3xl font-extrabold mx-auto mb-3 shadow-md">
            +
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Blood-Connect</h1>
          <p className="text-xs uppercase tracking-widest text-red-100 font-semibold mt-1">
            Philippine Red Cross Admin Portal
          </p>
        </div>

        {/* Form Area */}
        <div className="p-8 space-y-6">
          {(error || redirectedError) && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm">
              <LuShieldAlert size={20} className="shrink-0 text-rose-600" />
              <span>{error || redirectedError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1 uppercase tracking-wider">
                Admin Email Address
              </label>
              <div className="relative">
                <LuMail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@redcross.ph"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D32F2F] focus:border-[#D32F2F] focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <LuLock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D32F2F] focus:border-[#D32F2F] focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#D32F2F] hover:bg-[#B71C1C] disabled:opacity-50 text-white font-bold rounded-lg text-sm shadow-md transition-all mt-2"
            >
              {loading ? "Authenticating..." : "Sign In to Admin Dashboard"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Authorized Personnel Only • Philippine Red Cross System
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;