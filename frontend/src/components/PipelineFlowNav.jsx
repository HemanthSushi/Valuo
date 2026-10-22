import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Database,
  BarChart2,
  Cpu,
  Trophy,
  Sparkles,
  Calculator,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  Layers,
  FolderOpen,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import api from "@/lib/api";

export const PIPELINE_STEPS = [
  {
    step: 1,
    id: "data",
    name: "Data Hub",
    shortName: "Hub",
    desc: "Ingestion & Datasets",
    path: "/home",
    requiresDataset: false,
    icon: Database,
  },
  {
    step: 2,
    id: "profiling",
    name: "Data Profiling",
    shortName: "Profiling",
    desc: "Distributions & EDA",
    basePath: "/eda",
    requiresDataset: true,
    icon: BarChart2,
  },
  {
    step: 3,
    id: "studio",
    name: "Model Studio",
    shortName: "Studio",
    desc: "RF & XGBoost Training",
    basePath: "/train",
    requiresDataset: true,
    icon: Cpu,
  },
  {
    step: 4,
    id: "leaderboard",
    name: "Leaderboard",
    shortName: "Leaderboard",
    desc: "Dual-Engine Metrics",
    basePath: "/compare",
    requiresDataset: true,
    icon: Trophy,
  },
  {
    step: 5,
    id: "insights",
    name: "SHAP Insights",
    shortName: "Insights",
    desc: "Feature Explainability",
    basePath: "/explainability",
    requiresDataset: true,
    icon: Sparkles,
  },
  {
    step: 6,
    id: "valuation",
    name: "Valuation Lab",
    shortName: "Valuation",
    desc: "Property Price Estimator",
    basePath: "/predict",
    requiresDataset: true,
    icon: Calculator,
  },
  {
    step: 7,
    id: "trends",
    name: "Market Trends",
    shortName: "Trends",
    desc: "ARIMA Projections",
    basePath: "/forecast",
    requiresDataset: true,
    icon: TrendingUp,
  },
];

export default function PipelineFlowNav({ activeDatasetId }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeMeta, setActiveMeta] = useState(null);

  // Fallback demo ID if none selected
  const fallbackDatasetId = "06390047-ef89-4508-b930-6fc7a47f5e05";
  const effectiveId = activeDatasetId || fallbackDatasetId;

  // Load available datasets from SQLite database
  useEffect(() => {
    async function fetchDatasets() {
      try {
        const res = await api.get("/datasets");
        if (Array.isArray(res.data) && res.data.length > 0) {
          setDatasets(res.data);
        }
      } catch (e) {
        // Silently handle if offline
      }
    }
    fetchDatasets();
  }, []);

  // Load metadata for current active dataset
  useEffect(() => {
    if (!effectiveId) return;
    async function fetchMeta() {
      try {
        const res = await api.get(`/meta/${effectiveId}`);
        setActiveMeta(res.data);
      } catch (e) {
        // Silently handle
      }
    }
    fetchMeta();
  }, [effectiveId]);

  // Determine current active step
  const currentStep = PIPELINE_STEPS.find((s) => {
    if (s.path && location.pathname === s.path) return true;
    if (s.basePath && location.pathname.startsWith(s.basePath)) return true;
    return false;
  }) || PIPELINE_STEPS[0];

  const handleDatasetSwitch = (newId) => {
    setDropdownOpen(false);
    if (!newId) return;
    // Keep user on the same functional stage if on a dataset-dependent route
    if (currentStep.basePath) {
      navigate(`${currentStep.basePath}/${newId}`);
    } else {
      navigate(`/eda/${newId}`);
    }
  };

  return (
    <div className="w-full mb-8 bg-[#DCDCCA]/90 backdrop-blur-md border border-[#88867C]/50 rounded-2xl p-3 sm:p-4 shadow-sm text-left">
      {/* Top Meta Bar: Active Dataset & Pipeline Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#88867C]/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#222222] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#222222]"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#88867C]">
              Pipeline Workspace
            </span>
          </div>

          {/* Dataset Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#C4C0AC]/70 hover:bg-[#C4C0AC] text-xs font-bold text-[#222222] border border-[#88867C]/50 transition-all cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#222222]" />
              <span className="font-mono text-[11px] truncate max-w-[140px] sm:max-w-[200px]">
                {activeMeta ? `Dataset: ${activeMeta.rows.toLocaleString()} rows` : `ID: ${effectiveId.slice(0, 8)}...`}
              </span>
              <ChevronDown className="w-3 h-3 text-[#88867C]" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-[#DCDCCA] border border-[#88867C] shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#88867C] border-b border-[#88867C]/40">
                  Switch Active Dataset ({datasets.length || 1} available)
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {datasets.length > 0 ? (
                    datasets.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleDatasetSwitch(d.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          d.id === effectiveId
                            ? "bg-[#222222] text-[#DCDCCA] font-semibold"
                            : "hover:bg-[#C4C0AC] text-[#88867C] hover:text-[#222222]"
                        }`}
                      >
                        <div className="truncate">
                          <p className={`font-medium truncate ${d.id === effectiveId ? "text-[#DCDCCA]" : "text-[#222222]"}`}>{d.filename || "Housing Data"}</p>
                          <p className={`text-[10px] ${d.id === effectiveId ? "text-[#DCDCCA]/70" : "text-[#88867C]"}`}>
                            {d.rows.toLocaleString()} rows • {d.columns} features
                          </p>
                        </div>
                        {d.id === effectiveId && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#DCDCCA] shrink-0" />
                        )}
                      </button>
                    ))
                  ) : (
                    <button
                      onClick={() => handleDatasetSwitch(fallbackDatasetId)}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-[#222222] hover:bg-[#C4C0AC]"
                    >
                      Canonical Demo Housing Dataset
                    </button>
                  )}
                </div>
                <div className="pt-1 border-t border-[#88867C]/40">
                  <Link
                    to="/home"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#222222] hover:bg-[#C4C0AC] transition-colors"
                  >
                    <span>+ Ingest New Dataset</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step Counter Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#88867C] font-semibold">Stage:</span>
          <span className="px-2 py-0.5 rounded-md bg-[#222222] text-[#DCDCCA] font-bold font-mono">
            {currentStep.step} of {PIPELINE_STEPS.length}
          </span>
          <span className="font-bold text-[#222222] hidden md:inline">
            • {currentStep.name}
          </span>
        </div>
      </div>

      {/* Horizontal Flow Stepper Carousel / Track */}
      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
        {PIPELINE_STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = s.step === currentStep.step;
          const isPassed = s.step < currentStep.step;
          const targetUrl = s.requiresDataset ? `${s.basePath}/${effectiveId}` : s.path;

          return (
            <React.Fragment key={s.id}>
              <Link
                to={targetUrl}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0 ${
                  isActive
                    ? "bg-[#222222] text-[#DCDCCA] shadow-md shadow-[#222222]/20 scale-[1.02]"
                    : isPassed
                    ? "bg-[#DCDCCA] hover:bg-[#C4C0AC] text-[#222222] border border-[#88867C]/50"
                    : "text-[#88867C] hover:text-[#222222] hover:bg-[#DCDCCA] border border-transparent"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                    isActive
                      ? "bg-[#DCDCCA]/20 text-[#DCDCCA]"
                      : isPassed
                      ? "bg-[#222222] text-[#DCDCCA]"
                      : "bg-[#C4C0AC] text-[#222222]"
                  }`}
                >
                  {isPassed ? "✓" : s.step}
                </div>
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#DCDCCA]" : "text-[#88867C]"}`} />
                <span>{s.name}</span>
              </Link>

              {idx < PIPELINE_STEPS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-[#88867C]/50 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// Reusable Bottom Stage Navigator on Every Page
export function StageFooterNav({ currentStepId, datasetId }) {
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.id === currentStepId);
  if (currentIndex === -1) return null;

  const prevStep = currentIndex > 0 ? PIPELINE_STEPS[currentIndex - 1] : null;
  const nextStep = currentIndex < PIPELINE_STEPS.length - 1 ? PIPELINE_STEPS[currentIndex + 1] : null;

  const prevUrl = prevStep
    ? prevStep.requiresDataset
      ? `${prevStep.basePath}/${datasetId}`
      : prevStep.path
    : null;

  const nextUrl = nextStep
    ? nextStep.requiresDataset
      ? `${nextStep.basePath}/${datasetId}`
      : nextStep.path
    : null;

  return (
    <div className="pt-8 mt-12 border-t border-[#88867C]/50 flex flex-col sm:flex-row items-center justify-between gap-4">
      {prevStep ? (
        <Link
          to={prevUrl}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[#88867C]/60 bg-[#DCDCCA] hover:bg-[#C4C0AC] text-xs font-bold text-[#222222] transition-all shadow-xs"
        >
          <span>← Back to {prevStep.name}</span>
        </Link>
      ) : (
        <div />
      )}

      {nextStep ? (
        <Link
          to={nextUrl}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#222222] hover:bg-[#111111] text-[#DCDCCA] text-xs font-bold shadow-md shadow-[#222222]/20 hover:-translate-y-0.5 active:translate-y-0 transition-all"
        >
          <span>Proceed to {nextStep.name}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ) : (
        <Link
          to="/home"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#222222] hover:bg-[#111111] text-[#DCDCCA] text-xs font-bold shadow-md shadow-[#222222]/20 transition-all"
        >
          <span>Complete Workflow • Ingest New Data</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
