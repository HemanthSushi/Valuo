import React from "react";

export default function HavenixAuthShowcase({
  overlayText = "Predict true property value with precision AI models.",
}) {
  return (
    <div className="relative w-full h-full min-h-[500px] max-h-[720px] flex items-center justify-center select-none">
      {/* Scalable SVG Definition for the organic Havenix stepped cutout silhouette */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <defs>
          <clipPath id="havenix-stepped-portal" clipPathUnits="objectBoundingBox">
            <path
              d="
                M 0.32 0
                L 0.88 0
                C 0.95 0, 1 0.05, 1 0.12
                L 1 0.74
                C 1 0.78, 0.97 0.81, 0.92 0.81
                L 0.84 0.81
                C 0.79 0.81, 0.76 0.85, 0.76 0.89
                C 0.76 0.95, 0.71 1, 0.65 1
                L 0.12 1
                C 0.05 1, 0 0.95, 0 0.88
                L 0 0.22
                C 0 0.16, 0.04 0.13, 0.10 0.13
                L 0.18 0.13
                C 0.23 0.13, 0.26 0.09, 0.26 0.05
                C 0.26 0.01, 0.29 0, 0.32 0
                Z
              "
            />
          </clipPath>
        </defs>
      </svg>

      {/* Clipped Container */}
      <div
        className="relative w-full h-full min-h-[480px] overflow-hidden shadow-2xl transition-all duration-300 group"
        style={{
          clipPath: "url(#havenix-stepped-portal)",
          WebkitClipPath: "url(#havenix-stepped-portal)",
        }}
      >
        {/* Surreal Architectural Portal Photo */}
        <img
          src="/images/everhome_villa.jpg"
          alt="Valuo Everhome Architectural Villa & Garden"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
        />

        {/* Ambient Top & Bottom Contrast Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/25 pointer-events-none" />

        {/* Top-Right Tagline Overlay */}
        <div className="absolute top-8 sm:top-10 right-6 sm:right-10 max-w-[280px] text-right z-10 pointer-events-none">
          <p className="text-[#DCDCCA] text-xs sm:text-sm md:text-[15px] font-bold leading-relaxed drop-shadow-md">
            {overlayText}
          </p>
        </div>

        {/* Subtle Architectural Glow Accent */}
        <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-[#222222]/30 rounded-full blur-2xl pointer-events-none" />
      </div>
    </div>
  );
}
