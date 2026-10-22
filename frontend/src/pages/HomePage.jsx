import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calculator,
  User,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function HomePage() {
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

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* 1. Full Image Background covering 100% of the viewport (Edge-to-Edge) */}
      <img
        src="/images/everhome_villa.jpg"
        alt="Valuo Luxury Villa Background"
        className="absolute inset-0 w-full h-full object-cover object-center z-0"
      />

      {/* 2. Soft Ambient Film Overlays for Optimal Text Readability & Contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/75 z-0 pointer-events-none" />
      <div className="absolute inset-0 bg-black/15 z-0 pointer-events-none" />

      {/* Top Right Transparent User Details Icon */}
      <div className="absolute top-6 sm:top-8 right-6 sm:right-12 z-50" ref={userMenuRef}>
        <button
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          className="p-1.5 bg-transparent border-none text-[#DCDCCA] hover:text-white flex items-center justify-center drop-shadow-2xl hover:scale-110 active:scale-95 transition-all outline-none"
          title="User Account Details"
          aria-label="User Account Details"
        >
          <User className="w-6 h-6 sm:w-7 sm:h-7 text-[#DCDCCA] hover:text-white drop-shadow-xl" />
        </button>

        {/* User Details Dropdown Modal */}
        {showUserDropdown && (
          <div className="absolute right-0 mt-3 w-72 rounded-2xl bg-[#DCDCCA] border border-[#88867C]/60 shadow-2xl p-4 z-50 animate-in fade-in-50 duration-150">
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
                <span>Status</span>
                <span className="font-semibold text-[#222222] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-700"></span>
                  Active Session
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#88867C]">
                <span>Platform</span>
                <span className="font-semibold text-[#222222]">Valuo Enterprise</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#88867C]/30">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#222222] hover:bg-black text-[#DCDCCA] text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Foreground Content Layer: Exactly Single Screen */}
      <div className="relative z-10 h-full w-full flex flex-col justify-between px-6 sm:px-12 md:px-16 pt-8 sm:pt-12 pb-10 sm:pb-14 max-w-7xl mx-auto">
        
        {/* Top Section: Giant Valuo Heading */}
        <div className="w-full pt-2">
          <h1 className="text-6xl sm:text-8xl md:text-9xl lg:text-[10.5rem] xl:text-[11.5rem] font-black text-[#DCDCCA]/85 tracking-tighter leading-none font-heading drop-shadow-2xl">
            Valuo
          </h1>
        </div>

        {/* Bottom Section: Floating Invisible Buttons (Left) & New Tagline (Right) */}
        <div className="w-full flex flex-col md:flex-row items-start md:items-end justify-between gap-8 pb-2">
          
          {/* ONLY TWO BUTTONS: Completely Invisible with Floating Icon + Text */}
          <div className="flex items-center gap-8 sm:gap-12 z-20">
            {/* Button 1: Dashboard (Icon first, before text) */}
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2.5 text-white hover:text-[#DCDCCA] text-base sm:text-lg md:text-xl font-bold drop-shadow-2xl hover:scale-105 active:scale-95 transition-all group"
            >
              <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:text-[#DCDCCA] drop-shadow-md group-hover:scale-110 transition-all" />
              <span className="tracking-wide">Dashboard</span>
            </Link>

            {/* Button 2: Predict (Icon first, before text) */}
            <Link
              to="/predict"
              className="inline-flex items-center gap-2.5 text-white hover:text-[#DCDCCA] text-base sm:text-lg md:text-xl font-bold drop-shadow-2xl hover:scale-105 active:scale-95 transition-all group"
            >
              <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:text-[#DCDCCA] drop-shadow-md group-hover:scale-110 transition-all" />
              <span className="tracking-wide">Predict</span>
            </Link>
          </div>

          {/* Tagline replacing "A place that truly feels like home" */}
          <div className="text-left md:text-right pointer-events-none max-w-xl">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white/75 tracking-tight leading-[1.15] font-heading drop-shadow-xl">
              Where architectural <br />
              elegance meets <br />
              intelligent valuation
            </h2>
          </div>

        </div>

      </div>
    </div>
  );
}