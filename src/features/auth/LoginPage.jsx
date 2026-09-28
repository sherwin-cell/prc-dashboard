import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { 
  Lock as LuLock, 
  Mail as LuMail, 
  ShieldAlert as LuShieldAlert, 
  ShieldCheck as LuShieldCheck, 
  Users as LuUsers, 
  Heart as LuHeart, 
  Eye as LuEye, 
  EyeOff as LuEyeOff, 
  Globe as LuGlobe, 
  ArrowRight as LuArrowRight, 
  Shield as LuShield 
} from "lucide-react";



const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
      await login(email, password, rememberMe);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Login failed:", err);
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Invalid admin credentials.");
      } else {
        setError("Failed to sign in. Check your internet connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      {/* Top Bar for small elements if any */}
      <div className="w-full flex justify-end p-4 lg:hidden">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-xs">
          <LuGlobe size={14} />
          <span>English</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 lg:p-6">
        <div className="max-w-6xl w-full bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">

          {/* LEFT SIDE: Brand, Slogan, Background Image overlay & Features */}
          <div className="relative bg-gradient-to-b from-red-50/60 via-red-100/30 to-red-50/80 p-8 lg:p-12 flex flex-col justify-between overflow-hidden border-r border-gray-100">
            {/* Background decorative styling / placeholder for hospital landscape image */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D32F2F_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

            {/* Top Brand Section */}
            <div className="relative z-10 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
                <div className="w-14 h-14 bg-white text-[#D32F2F] rounded-full flex items-center justify-center shadow-md border border-red-100">
                  {/* Red Cross Cross Graphic representation */}
                  <div className="relative flex items-center justify-center w-8 h-8">
                    <div className="absolute w-full h-3.5 bg-[#D32F2F] rounded-xs"></div>
                    <div className="absolute h-full w-3.5 bg-[#D32F2F] rounded-xs"></div>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold tracking-widest text-[#D32F2F] uppercase block">
                    Philippine Red Cross
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    Admin Web App
                  </span>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900">
                  BLOOD-<span className="text-[#D32F2F]">CONNECT</span>
                </h1>
                <p className="text-sm font-semibold text-gray-600">
                  PRC Admin Web App
                </p>
                <p className="text-sm text-gray-500 max-w-sm mt-4 font-normal leading-relaxed">
                  Coordinating. Verifying. Connecting. <br />
                  Saving lives together.
                </p>
              </div>
            </div>

            {/* Middle Graphic / Illustration Space */}
            <div className="relative z-10 my-8 py-4 hidden lg:block">
              <div className="w-full h-36 rounded-2xl bg-gradient-to-r from-red-500/10 via-rose-500/5 to-transparent border border-red-100/50 flex items-center px-6 shadow-inner relative overflow-hidden">
                <div className="space-y-2">
                  <span className="inline-block px-2.5 py-1 bg-red-100 text-[#D32F2F] text-[10px] font-bold uppercase tracking-wider rounded-md">
                    Secure Gateway
                  </span>
                  <p className="text-xs text-gray-600 max-w-xs">
                    Real-time blood inventory control management system for authorized coordinators.
                  </p>
                </div>
                <div className="absolute right-[-10px] bottom-[-20px] text-red-500/10">
                  <LuHeart size={120} />
                </div>
              </div>
            </div>

            {/* Bottom Footer Features */}
            <div className="relative z-10 grid grid-cols-3 gap-4 pt-6 border-t border-red-200/40 text-center">
              <div>
                <div className="flex justify-center text-[#D32F2F] mb-1.5">
                  <LuShieldCheck size={20} />
                </div>
                <h4 className="text-xs font-bold text-gray-800">Secure</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">Your data is protected</p>
              </div>
              <div>
                <div className="flex justify-center text-[#D32F2F] mb-1.5">
                  <LuUsers size={20} />
                </div>
                <h4 className="text-xs font-bold text-gray-800">Reliable</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">Real-time updates</p>
              </div>
              <div>
                <div className="flex justify-center text-[#D32F2F] mb-1.5">
                  <LuHeart size={20} />
                </div>
                <h4 className="text-xs font-bold text-gray-800">Life-saving</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">Every action matters</p>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Log in form */}
          <div className="p-8 lg:p-12 flex flex-col justify-between bg-white relative">

            {/* Top Language Select (Desktop) */}
            <div className="hidden lg:flex justify-end w-full mb-6">
              <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                <LuGlobe size={14} className="text-gray-500" />
                <span>English</span>
              </button>
            </div>

            <div className="max-w-md w-full mx-auto my-auto">
              {/* Form Title & Security Shield icon */}
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                    Log in to your account
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Welcome back! Please enter your credentials to continue.
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-[#D32F2F] shrink-0 border border-red-100">
                  <LuShield size={20} />
                </div>
              </div>

              {/* Error Notification Alert */}
              {(error || redirectedError) && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm animate-shake">
                  <LuShieldAlert size={20} className="shrink-0 text-rose-600" />
                  <span className="text-xs font-medium">{error || redirectedError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <LuMail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D32F2F] focus:border-[#D32F2F] focus:bg-white focus:outline-hidden transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Password
                    </label>
                    <a
                      href="#forgot-password"
                      onClick={(e) => {
                        e.preventDefault();
                        alert("Please contact your system administrator to reset your password.");
                      }}
                      className="text-xs font-semibold text-[#D32F2F] hover:underline"
                    >
                      Forgot Password?
                    </a>
                  </div>
                  <div className="relative">
                    <LuLock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D32F2F] focus:border-[#D32F2F] focus:bg-white focus:outline-hidden transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-hidden"
                    >
                      {showPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Support Help Link */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-[#D32F2F] border-gray-300 rounded focus:ring-[#D32F2F] accent-[#D32F2F]"
                    />
                    <span className="text-gray-600 font-medium">Remember me</span>
                  </label>
                  <a
                    href="#support"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Reach out to your regional IT support desk.");
                    }}
                    className="text-gray-500 hover:text-gray-800 font-medium"
                  >
                    Need help? Contact PRC IT Support
                  </a>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#D32F2F] hover:bg-[#B71C1C] disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
                >
                  {loading ? (
                    "Authenticating..."
                  ) : (
                    <>
                      <span>Log In</span>
                      <LuArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Bottom Copyright Information */}
            <div className="text-center lg:text-right mt-12 pt-4 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 font-medium">
                © {new Date().getFullYear()} Philippine Red Cross — Sorsogon Chapter. All rights reserved.
              </p>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;