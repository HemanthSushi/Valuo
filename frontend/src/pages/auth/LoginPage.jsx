import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, AlertCircle, HelpCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import HavenixAuthShowcase from "@/components/HavenixAuthShowcase";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);

  const validateField = (name, value) => {
    let error = "";
    if (name === "email") {
      if (!value.trim()) {
        error = "Email address is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        error = "Please enter a valid email address.";
      }
    } else if (name === "password") {
      if (!value) {
        error = "Password is required.";
      }
    }
    return error;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
    setServerError("");
    if (touched[name]) {
      const error = validateField(name, val);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailErr = validateField("email", formData.email);
    const passErr = validateField("password", formData.password);

    setTouched({ email: true, password: true });
    setErrors({ email: emailErr, password: passErr });

    if (emailErr || passErr) {
      return;
    }

    setLoading(true);
    setServerError("");

    try {
      await login(formData.email, formData.password, formData.rememberMe);
      toast.success("Welcome back to Valuo.");
      const destination = location.state?.from?.pathname || "/home";
      navigate(destination, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        "Invalid credentials. Please verify your email and password.";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen max-h-screen w-full bg-[#C4C0AC] flex items-center justify-center p-1.5 sm:p-2.5 md:p-3 overflow-hidden font-sans selection:bg-[#222222]/20 selection:text-[#222222]">
      {/* Outer Container - Seamless with background, no border */}
      <div className="w-full max-w-5xl xl:max-w-6xl min-h-[580px] lg:min-h-[620px] h-[calc(100vh-0.75rem)] sm:h-[calc(100vh-1.25rem)] max-h-[760px] flex flex-col bg-[#C4C0AC] overflow-hidden">
        {/* Main Split Content Area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 px-6 sm:px-10 lg:px-12 py-3 sm:py-4 lg:py-5 gap-6 lg:gap-10 items-stretch overflow-hidden">
          {/* Left Column: Form */}
          <div className="lg:col-span-6 w-full max-w-sm mx-auto flex flex-col justify-center space-y-3 sm:space-y-3.5 text-left py-1">
            {/* Brand Logo */}
            <div>
              <Link to="/home" className="inline-flex items-center gap-2.5 group">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#222222] flex items-center justify-center text-[#DCDCCA] shadow-md shadow-[#222222]/20 group-hover:scale-105 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="10" width="4.5" height="11" rx="2.25" fill="#DCDCCA" />
                    <circle cx="5.25" cy="5" r="2.25" fill="#DCDCCA" />
                    <path
                      d="M11 5C11 3.34315 12.3431 2 14 2H18C19.6569 2 21 3.34315 21 5V21H16.5V7C16.5 6.44772 16.0523 6 15.5 6H11V5Z"
                      fill="#DCDCCA"
                    />
                  </svg>
                </div>
                <span className="text-xl sm:text-2xl font-extrabold text-[#222222] tracking-tight font-heading">
                  Valuo<span className="text-[#88867C]">.</span>
                </span>
              </Link>
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#222222] tracking-tight font-heading leading-tight">
                Welcome Back
              </h1>
              <p className="text-xs sm:text-[13px] text-[#88867C] mt-1 font-semibold">
                Predict accurate home prices with AI.
              </p>
            </div>

            {/* Social Logins */}
            <div className="space-y-2">
              {/* Google Button */}
              <button
                type="button"
                onClick={() => toast.info("Google authentication demo connected")}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-[#88867C]/50 bg-[#DCDCCA] hover:bg-[#DCDCCA]/80 active:scale-[0.99] transition-all text-xs sm:text-sm font-semibold text-[#222222] shadow-2xs"
              >
                <svg className="w-4 h-4 fill-current text-[#222222]" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Facebook / Apple Button */}
              <button
                type="button"
                onClick={() => toast.info("Facebook authentication demo connected")}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-[#88867C]/50 bg-[#DCDCCA] hover:bg-[#DCDCCA]/80 active:scale-[0.99] transition-all text-xs sm:text-sm font-semibold text-[#222222] shadow-2xs"
              >
                <svg className="w-4 h-4 fill-current text-[#222222]" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.9.04-2 .6-2.64 1.35-.57.65-1.06 1.73-.93 2.77 1 .08 1.95-.5 2.56-1.25z" />
                </svg>
                <span>Continue with Facebook</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-2 flex items-center justify-center">
              <div className="w-full border-t border-[#88867C]/50" />
              <span className="absolute bg-[#C4C0AC] px-3 text-xs text-[#88867C] font-bold">Or</span>
            </div>

            {/* Error Banner */}
            {serverError && (
              <div className="p-2.5 rounded-xl bg-[#DCDCCA] border border-[#222222] text-[#222222] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#222222]" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
              {/* Email Field */}
              <div className="space-y-1">
                <label
                  htmlFor="email-input"
                  className="block text-xs font-bold text-[#222222]"
                >
                  Email
                </label>
                <input
                  id="email-input"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur("email")}
                  placeholder="rownek@gmail.com"
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-[#DCDCCA] border text-xs sm:text-sm text-[#222222] placeholder:text-[#88867C] focus:bg-[#DCDCCA] focus:outline-none focus:ring-2 focus:ring-[#222222]/20 transition-all font-medium ${
                    touched.email && errors.email
                      ? "border-[#222222] focus:border-[#222222]"
                      : "border-[#88867C]/60 focus:border-[#222222]"
                  }`}
                />
                {touched.email && errors.email && (
                  <p className="text-[11px] text-[#222222] font-semibold">{errors.email}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <label
                  htmlFor="password-input"
                  className="block text-xs font-bold text-[#222222]"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password-input"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={() => handleBlur("password")}
                    placeholder="••••••••••••••"
                    className={`w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#DCDCCA] border text-xs sm:text-sm text-[#222222] placeholder:text-[#88867C] focus:bg-[#DCDCCA] focus:outline-none focus:ring-2 focus:ring-[#222222]/20 transition-all font-medium ${
                      touched.password && errors.password
                        ? "border-[#222222] focus:border-[#222222]"
                        : "border-[#88867C]/60 focus:border-[#222222]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#88867C] hover:text-[#222222] p-0.5"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {touched.password && errors.password && (
                  <p className="text-[11px] text-[#222222] font-semibold">{errors.password}</p>
                )}
              </div>

              {/* Remember Me & Forgot Password Row */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer text-[#222222] font-semibold select-none">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-[#88867C] text-[#222222] accent-[#222222] focus:ring-0 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[#222222] font-bold hover:text-[#88867C] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Submit Button (Attractive Black #222222 with Moon Mist #DCDCCA text) */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 sm:py-3 rounded-xl bg-[#222222] hover:bg-[#111111] active:scale-[0.99] text-[#DCDCCA] font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#DCDCCA]/30 border-t-[#DCDCCA] rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Login</span>
                )}
              </button>
            </form>

            {/* Bottom Link */}
            <p className="text-center text-[11px] sm:text-xs text-[#88867C] font-semibold pt-0.5">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="text-[#222222] font-bold hover:underline">
                Sign Up
              </Link>
            </p>
          </div>

          {/* Right Column: Signature Stepped Portal Showcase */}
          <div className="hidden lg:flex lg:col-span-6 w-full h-full items-center justify-center overflow-hidden py-1">
            <HavenixAuthShowcase overlayText="Predict true property value with precision AI models." />
          </div>
        </div>
      </div>

      {/* Forgot Password Assistance Modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 bg-[#222222]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#DCDCCA] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-[#88867C]/50 text-left">
            <div className="flex items-center gap-2 text-[#222222]">
              <HelpCircle className="w-5 h-5 text-[#222222]" />
              <h3 className="text-base font-bold text-[#222222]">Password Reset</h3>
            </div>
            <p className="text-xs text-[#88867C] leading-relaxed font-medium">
              If you forgot your password, please contact your workspace administrator or create a new account via the Sign Up page.
            </p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#222222] text-[#DCDCCA] hover:bg-[#111111] transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}