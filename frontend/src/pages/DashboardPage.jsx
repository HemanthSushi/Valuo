import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Calculator,
  Building,
  LogOut,
  Home,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userMenuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out successfully.");
    navigate("/login");
  };

  const displayName = user?.name || "Hemanth Sushi";
  const displayEmail = user?.email || "user@valuo.ai";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Equalizer lines representation for Price Variation Dynamics (Price spectrum density)
  const equalizerBars = Array.from({ length: 42 }, (_, i) => {
    let type = "dark"; // #222222 (Budget to Mid range 50L - 1.5Cr)
    if (i >= 24 && i < 33) type = "accent"; // purple/accent (Luxury 1.5Cr - 4Cr)
    if (i >= 33) type = "light"; // faint stone (Ultra-luxury 4Cr+)
    return { id: i, type };
  });

  // Price per Sqft stepped heights
  const sparklineBars = [
    { height: 12, active: false },
    { height: 18, active: false },
    { height: 16, active: false },
    { height: 36, active: true },
    { height: 24, active: false },
    { height: 30, active: false },
    { height: 18, active: false },
    { height: 22, active: false },
  ];

  return (
    <div className="min-h-full w-full max-w-7xl mx-auto flex flex-col justify-between select-none">
      {/* Outer Dashboard Frame (Fluid & Responsive on all Screen Resolutions) */}
      <div className="bg-[#DCDCCA] rounded-2xl sm:rounded-3xl border border-[#88867C]/50 shadow-xl p-3 sm:p-5 flex-1 flex flex-col justify-between">
        
        {/* Top Header Utilities Bar */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#88867C]/30 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <Link
              to="/home"
              className="text-[11px] font-bold uppercase tracking-wider text-[#88867C] hover:text-[#222222] transition-colors flex items-center gap-1"
              title="Return to Home"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Valuo</span>
            </Link>
            <span className="text-xs text-[#88867C]">/</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#88867C] hidden sm:inline">
              Dataset Intelligence
            </span>
            <span className="text-xs text-[#88867C] hidden sm:inline">/</span>
            <div className="flex items-center gap-1.5 px-3 py-0.5 bg-[#C4C0AC]/70 rounded-full border border-[#88867C]/40 text-xs font-bold text-[#222222]">
              <Building className="w-3.5 h-3.5" />
              <span>Bangalore Real Estate Benchmark (13,320 Records)</span>
            </div>
          </div>

          {/* Right Header Controls: Predict Button + Client Details Icon */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              to="/predict"
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-[#222222] hover:bg-black text-[#DCDCCA] text-xs font-bold shadow-xs hover:scale-105 active:scale-95 transition-all"
              title="Open Prediction Lab"
            >
              <Calculator className="w-3.5 h-3.5 text-[#DCDCCA]" />
              <span>Predict</span>
            </Link>

            {/* Client Details Icon */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="relative cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                title="Account Details"
              >
                <div className="w-8 h-8 rounded-full bg-[#222222] text-[#DCDCCA] flex items-center justify-center font-bold text-xs shadow-inner overflow-hidden border border-[#88867C]">
                  <span className="font-heading text-[11px]">{initials}</span>
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-700 rounded-full border border-[#DCDCCA]"></span>
              </button>

              {/* User Dropdown */}
              {showUserDropdown && (
                <div className="absolute right-0 top-10 mt-2 w-72 rounded-2xl bg-[#DCDCCA] border border-[#88867C]/60 shadow-2xl p-4 z-50 animate-in fade-in-50 duration-150">
                  <div className="flex items-center gap-3 pb-3 border-b border-[#88867C]/30">
                    <div className="w-10 h-10 rounded-full bg-[#222222] text-[#DCDCCA] flex items-center justify-center font-bold text-sm shadow-sm font-heading">
                      {initials}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-[#222222] truncate">{displayName}</p>
                      <p className="text-xs text-[#88867C] truncate">{displayEmail}</p>
                    </div>
                  </div>

                  <div className="py-3 space-y-2 text-xs text-[#222222]">
                    <div className="flex items-center justify-between text-[11px] text-[#88867C]">
                      <span>Role</span>
                      <span className="font-semibold text-[#222222]">Portfolio Manager</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#88867C]">
                      <span>Active Dataset</span>
                      <span className="font-semibold text-[#222222]">13,320 Records</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#88867C]/30 flex flex-col gap-2">
                    <Link
                      to="/predict"
                      className="w-full py-1.5 px-3 rounded-lg bg-[#C4C0AC] hover:bg-[#C4C0AC]/80 text-[#222222] text-xs font-bold text-center border border-[#88867C]/50"
                    >
                      Open Prediction Lab
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-[#222222] hover:bg-black text-[#DCDCCA] text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Dashboard Grid: Center Stage + Right Metric Rail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch flex-1 pt-2.5">
          
          {/* Center Stage: Projects & Dataset Overview + Center Building + Bottom 3 Stats */}
          <div className="lg:col-span-7 flex flex-col justify-between px-1 sm:px-2">
            
            {/* Title Section */}
            <div className="text-center">
              <p className="text-[10px] sm:text-xs font-semibold text-[#88867C] tracking-wide uppercase">
                Dataset Behavior & Market Overview
              </p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-[#222222] tracking-tight font-heading mt-0.5">
                Valuo Real Estate Intelligence
              </h1>
            </div>

            {/* Central Architectural Render Model */}
            <div className="my-2 relative flex items-center justify-center flex-1 max-h-[300px] group overflow-hidden">
              <div className="relative max-w-md w-full h-full flex items-center justify-center">
                <img
                  src="/images/crescent_park_building.jpg"
                  alt="Valuo Architectural Property Model"
                  className="w-full h-full object-contain filter drop-shadow-2xl transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = "/images/skyline-apartments.jpg";
                  }}
                />
              </div>

              {/* Interactive Feature Tags Floating on Model */}
              <div className="absolute top-2 left-2 hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#222222]/85 backdrop-blur-md rounded-full text-[10px] text-[#DCDCCA] font-semibold border border-white/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Top Feature: Total Sqft (+48% Weight)</span>
              </div>

              <div className="absolute bottom-2 right-2 hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#222222]/85 backdrop-blur-md rounded-full text-[10px] text-[#DCDCCA] font-semibold border border-white/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DCDCCA]"></span>
                <span>Prime Locality: Whitefield (540 Units)</span>
              </div>

              {/* Direct Prediction CTA Pill */}
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20">
                <Link
                  to="/predict"
                  className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#222222]/90 backdrop-blur-md text-[#DCDCCA] text-xs font-bold rounded-full shadow-xl hover:bg-black hover:scale-105 active:scale-95 transition-all border border-white/20"
                >
                  <Calculator className="w-3.5 h-3.5 text-[#DCDCCA]" />
                  <span>Predict Property Value</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#DCDCCA]" />
                </Link>
              </div>
            </div>

            {/* Bottom 3 Summary Statistics (Dataset Behavior & Health) */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#88867C]/30 text-left flex-shrink-0">
              {/* Stat 1: Dataset Size & Features */}
              <div className="space-y-0.5">
                <div className="text-2xl sm:text-3xl font-light text-[#222222] tracking-tight font-heading">
                  13,320
                </div>
                <div className="text-[11px] font-bold text-[#222222]">
                  Total Properties
                </div>
                <div className="text-[10px] text-[#88867C]">
                  9 curated dataset features
                </div>
              </div>

              {/* Stat 2: Price Behavior & Distribution */}
              <div className="space-y-0.5">
                <div className="text-2xl sm:text-3xl font-light text-[#222222] tracking-tight font-heading">
                  ₹ 112.5 L
                </div>
                <div className="text-[11px] font-bold text-[#222222]">
                  Average Price
                </div>
                <div className="text-[10px] text-[#88867C]">
                  Median: ₹ 72.0 Lakhs
                </div>
              </div>

              {/* Stat 3: Model Accuracy & Confidence */}
              <div className="space-y-0.5">
                <div className="text-2xl sm:text-3xl font-light text-[#222222] tracking-tight font-heading">
                  89.4%
                </div>
                <div className="text-[11px] font-bold text-[#222222]">
                  Model Confidence
                </div>
                <div className="text-[10px] text-[#88867C]">
                  RandomForest + XGBoost
                </div>
              </div>
            </div>

          </div>

          {/* Right Rail: 4 Stacked Metric Panels (Dataset Features & Price Variation) */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-2.5">
            
            {/* Card 1: Price Variation Dynamics (Lead Velocity Style Equalizer) */}
            <div className="bg-[#C4C0AC]/50 rounded-xl p-3 border border-[#88867C]/40 shadow-xs relative">
              <div className="flex items-center justify-between text-[11px] text-[#88867C] font-semibold mb-1">
                <span>Price Variation Dynamics</span>
                <span className="text-[10px] text-[#222222] font-mono">₹ 8L – ₹ 36 Cr Range</span>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl sm:text-3xl font-light text-[#222222] tracking-tight font-heading">
                  ₹ 8L - 36Cr
                </span>
                <div className="flex items-center gap-2 text-[10px] text-[#222222]">
                  <div><span className="font-bold">2BHK:</span> <span className="text-[#88867C]">₹54L</span></div>
                  <div><span className="font-bold">3BHK:</span> <span className="text-[#88867C]">₹1.05Cr</span></div>
                  <div><span className="font-bold">4BHK:</span> <span className="text-[#88867C]">₹2.4Cr</span></div>
                </div>
              </div>

              {/* Equalizer Bar Chart: Price Density Histogram */}
              <div className="flex items-end justify-between h-5 gap-[2px] px-1">
                {equalizerBars.map((bar) => {
                  let barColor = "bg-[#222222]";
                  if (bar.type === "accent") barColor = "bg-[#7E7497]";
                  if (bar.type === "light") barColor = "bg-[#88867C]/30";

                  return (
                    <div
                      key={bar.id}
                      className={`w-[2.5px] rounded-full transition-all ${barColor}`}
                      style={{
                        height: bar.type === "light" ? "10px" : "18px",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Card 2: Market Capitalization */}
            <div className="bg-[#C4C0AC]/50 rounded-xl p-3 border border-[#88867C]/40 shadow-xs">
              <div className="text-[11px] text-[#88867C] font-semibold mb-0.5">
                Total Market Capitalization
              </div>
              <div className="text-2xl sm:text-3xl font-light text-[#222222] tracking-tight font-heading">
                ₹ 14,994 Cr
              </div>
              <div className="text-[10px] text-[#88867C] font-medium">
                13,320 properties across 1,280+ micro-markets
              </div>
            </div>

            {/* Card 3: Price per Sqft Dynamics */}
            <div className="bg-[#C4C0AC]/50 rounded-xl p-3 border border-[#88867C]/40 shadow-xs">
              <div className="flex items-center justify-between text-[11px] text-[#88867C] font-semibold mb-1">
                <span>Price per Sqft Variance</span>
                <span className="text-[10px] text-[#88867C]">Built-up Scale</span>
              </div>

              <div className="flex items-end justify-between">
                <div className="flex items-start">
                  <span className="text-2xl sm:text-3xl font-light text-[#222222] tracking-tight font-heading">
                    ₹ 5,340
                  </span>
                  <span className="text-[10px] font-bold text-[#88867C] ml-1 mt-0.5">
                    /sqft (+12.4%)
                  </span>
                </div>

                {/* Mini Stepped Sparkline Bar Chart */}
                <div className="flex items-end gap-1.5 h-7 pb-0.5">
                  {sparklineBars.map((item, idx) => (
                    <div
                      key={idx}
                      className={`w-3 rounded-sm transition-all ${
                        item.active
                          ? "bg-[#7E7497] shadow-sm"
                          : "bg-[#88867C]/40 hover:bg-[#88867C]"
                      }`}
                      style={{ height: `${item.height * 0.7}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Card 4: Key Feature Importance (Concentric Arc Radar Chart) */}
            <div className="bg-[#C4C0AC]/50 rounded-xl p-3 border border-[#88867C]/40 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-[11px] text-[#88867C] font-semibold mb-0.5">
                <span>Key Feature Importance</span>
                <span className="text-[10px] text-[#88867C]">SHAP TreeExplainer</span>
              </div>

              {/* Arc Radar Visualization */}
              <div className="relative w-full h-24 flex items-center justify-center">
                <svg
                  className="w-full h-full"
                  viewBox="0 0 280 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="arcGlow2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#C4C0AC" stopOpacity="0.1" />
                      <stop offset="50%" stopColor="#7E7497" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#222222" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>

                  <path
                    d="M 20 110 A 100 100 0 0 1 240 110 Z"
                    fill="url(#arcGlow2)"
                  />
                  <path
                    d="M 30 110 A 90 90 0 0 1 250 110"
                    stroke="#222222"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M 30 110 A 65 65 0 0 1 210 110"
                    stroke="#222222"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M 30 110 A 42 42 0 0 1 170 110"
                    stroke="#222222"
                    strokeWidth="1.2"
                  />
                  <line
                    x1="20"
                    y1="110"
                    x2="260"
                    y2="110"
                    stroke="#88867C"
                    strokeWidth="0.8"
                    strokeDasharray="2 2"
                  />

                  <circle cx="30" cy="110" r="2.5" fill="#222222" />
                  <circle cx="80" cy="110" r="2" fill="#DCDCCA" />
                  <circle cx="125" cy="110" r="2" fill="#DCDCCA" />
                  <circle cx="170" cy="110" r="2.5" fill="#222222" />
                  <circle cx="210" cy="110" r="2.5" fill="#222222" />
                  <circle cx="250" cy="110" r="2.5" fill="#222222" />
                </svg>

                {/* Big Center Percentage */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
                  <span className="text-2xl sm:text-3xl font-light text-[#222222] tracking-tight font-heading">
                    72.7%
                  </span>
                </div>
              </div>

              {/* Bottom Feature Breakdown */}
              <div className="flex items-center justify-between text-[10px] text-[#222222] font-semibold pt-1 border-t border-[#88867C]/20">
                <div>
                  <span className="font-bold">Sqft (48%)</span>{" "}
                  <span className="text-[#88867C]">• Loc (28%)</span>
                </div>
                <div>
                  <span className="font-bold">Bath (14%)</span>{" "}
                  <span className="text-[#88867C]">• BHK (10%)</span>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
