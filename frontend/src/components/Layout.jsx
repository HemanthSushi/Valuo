import React from "react";
import { Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();
  const isHome = location.pathname === "/home";
  const isPredict = location.pathname.startsWith("/predict");

  return (
    <div
      className={`w-screen bg-[#C4C0AC] text-[#222222] flex flex-col font-sans selection:bg-[#222222]/20 selection:text-[#222222] relative ${
        isPredict ? "min-h-screen overflow-y-auto" : "h-screen max-h-screen overflow-hidden"
      }`}
    >
      {/* Main Page Canvas: Scrollable on Predict, full height locked on Home & Dashboard */}
      <main
        className={`flex-1 w-full ${
          isHome
            ? "p-0 h-full overflow-hidden"
            : isPredict
            ? "p-3 sm:p-6 min-h-screen overflow-y-auto"
            : "p-2 sm:p-3 h-full overflow-hidden"
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
