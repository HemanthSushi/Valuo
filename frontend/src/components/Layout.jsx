import React from "react";
import { Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();
  const isHome = location.pathname === "/home";
  const isPredict = location.pathname.startsWith("/predict");

  return (
    <div className="w-full min-h-screen bg-[#C4C0AC] text-[#222222] flex flex-col font-sans selection:bg-[#222222]/20 selection:text-[#222222] relative overflow-y-auto">
      {/* Main Page Canvas: Responsive min-h-screen with vertical scrolling across all application routes */}
      <main
        className={`flex-1 w-full min-h-screen ${
          isHome ? "p-0" : "p-3 sm:p-6 overflow-y-auto"
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
