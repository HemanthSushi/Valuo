import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Home, BarChart3, GitCompare, Zap, TrendingUp, Target } from "lucide-react";

const Layout = () => {
  const location = useLocation();
  const datasetId = location.pathname.split("/")[2];

  const navItems = [
    { name: "Home", path: "/home", icon: Home },
    { name: "EDA", path: `/eda/${datasetId}`, icon: BarChart3, requiresDataset: true },
    { name: "Train", path: `/train/${datasetId}`, icon: Target, requiresDataset: true },
    { name: "Compare", path: `/compare/${datasetId}`, icon: GitCompare, requiresDataset: true },
    { name: "Explainability", path: `/explainability/${datasetId}`, icon: Zap, requiresDataset: true },
    { name: "Predict", path: `/predict/${datasetId}`, icon: TrendingUp, requiresDataset: true },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* NAVBAR */}
      <nav className="glass-nav sticky top-0 z-50 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/home" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center">
                <Home className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">TrueWorth</span>
            </Link>

            <div className="flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const isDisabled = item.requiresDataset && !datasetId;

                return (
                  <Link
                    key={item.name}
                    to={isDisabled ? "#" : item.path}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isDisabled
                        ? "text-muted-foreground cursor-not-allowed"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* 🔥 THIS IS THE KEY FIX */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
