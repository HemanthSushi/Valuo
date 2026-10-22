import React, { useEffect, useState, useRef } from "react";
import { Palette, Check, Sparkles } from "lucide-react";

export const THEMES = [
  {
    id: "theme-warmstone",
    name: "Everhome Architectural",
    subtitle: "Moon Mist, Pastel Stone, Schooner & Black",
    isDark: false,
    colors: ["#DCDCCA", "#C4C0AC", "#88867C", "#222222"],
  },
];

export default function ThemeToggle() {
  const [currentTheme, setCurrentTheme] = useState("theme-warmstone");

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;

    // Clear previous theme classes
    THEMES.forEach((t) => root.classList.remove(t.id));
    root.classList.remove("dark");

    const selected = THEMES.find((t) => t.id === currentTheme) || THEMES[0];
    root.classList.add(selected.id);
    if (selected.isDark) {
      root.classList.add("dark");
    }

    localStorage.setItem("valuo_palette", currentTheme);
  }, [currentTheme]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const activeThemeObj = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary/70 hover:bg-secondary border border-border transition-all active:scale-95 shadow-xs"
        title="Change application color theme"
        aria-label="Color Palette Switcher"
        data-testid="theme-toggle"
      >
        <div className="flex items-center gap-1">
          {activeThemeObj.colors.map((c, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full ring-1 ring-white/20"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <span className="hidden sm:inline text-[11px] font-medium text-foreground ml-1">
          {activeThemeObj.name.split(" ")[0]}
        </span>
        <Palette className="w-3.5 h-3.5 text-[#88867C]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-dropdown border border-border p-2 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 border-b border-border/60 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Color Palette
            </span>
            <span className="text-[10px] text-[#222222] font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#222222]" />
              Signature
            </span>
          </div>

          <div className="space-y-1">
            {THEMES.map((t) => {
              const isSelected = t.id === currentTheme;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setCurrentTheme(t.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all ${
                    isSelected
                      ? "bg-primary/15 text-primary font-bold border border-primary/20"
                      : "hover:bg-secondary text-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-black/20 border border-white/10 shrink-0">
                      {t.colors.map((c, i) => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div>
                      <div className="text-xs font-semibold leading-tight">
                        {t.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">
                        {t.subtitle}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
