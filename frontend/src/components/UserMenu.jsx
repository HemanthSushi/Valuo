import React, { useState, useRef, useEffect } from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function UserMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const displayName = user?.name || "Analyst";
  const displayEmail = user?.email || "user@valuo.ai";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary rounded-[5px] border border-border transition-colors"
        data-testid="user-menu-button"
        aria-label="User account menu"
      >
        <span className="w-5 h-5 rounded-[4px] bg-accent text-accent-foreground flex items-center justify-center text-[10px] font-mono font-bold">
          {initials}
        </span>
        <span className="max-w-[120px] truncate">{displayName}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-56 bg-card border border-border rounded-[5px] shadow-sm py-1.5 z-50 animate-in fade-in-50 duration-100">
          <div className="px-3 py-2 border-b border-border/60">
            <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
            <p className="text-[11px] font-mono text-muted-foreground truncate">{displayEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 w-full text-xs text-destructive hover:bg-destructive/10 transition-colors text-left"
            data-testid="logout-button"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
