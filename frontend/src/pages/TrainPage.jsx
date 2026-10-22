import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  Sliders,
  CheckCircle2,
  Cpu,
  Zap,
  Layers,
  Sparkles,
  Target,
  ShieldCheck,
  Building2,
  BarChart3,
} from "lucide-react";
import api from "@/lib/api";
import { StageFooterNav } from "@/components/PipelineFlowNav";

export default function TrainPage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetFromUrl = searchParams.get("target");

  const [meta, setMeta] = useState(null);
  const [targetColumn, setTargetColumn] = useState(targetFromUrl || "");
  const [testSplit, setTestSplit] = useState(0.2);
  const [randomState, setRandomState] = useState(42);

  // Exactly two models: Random Forest and XGBoost (FR-5.1)
  const [selectedModels, setSelectedModels] = useState(["RandomForest", "XGBoost"]);
  const [training, setTraining] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await api.get(`/meta/${datasetId}`);
        setMeta(res.data);
        if (!targetColumn) {
          if (res.data.suggested_targets?.length > 0) {
            setTargetColumn(res.data.suggested_targets[0]);
          } else if (res.data.numeric_columns?.length > 0) {
            setTargetColumn(res.data.numeric_columns[0]);
          }
        }
      } catch (err) {
        toast.error("Failed to load dataset metadata.");
      } finally {
        setLoadingMeta(false);
      }
    }
    loadMeta();
  }, [datasetId, targetColumn]);

  const models = [
    {
      name: "RandomForest",
      label: "Random Forest Regressor",
      tag: "Bootstrap Aggregation (Bagging)",
      desc: "Constructs 50 randomized decision trees with bootstrap sub-sampling. Highly resilient against non-linear interactions and property outliers without overfitting.",
      specs: "50 estimators • max_depth 15 • RobustScaler + OneHotEncoder",
      icon: Layers,
      color: "from-emerald-500/10 via-card to-card border-emerald-500/30",
      accentText: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10 text-emerald-500",
    },
    {
      name: "XGBoost",
      label: "XGBoost Regressor",
      tag: "Regularized Gradient Boosting",
      desc: "Second-order gradient boosted decision trees with explicit L1/L2 regularization shrinkage. Optimized for high predictive precision on structured real estate features.",
      specs: "50 estimators • max_depth 10 • RobustScaler + OneHotEncoder",
      icon: Zap,
      color: "from-purple-500/10 via-card to-card border-purple-500/30",
      accentText: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-500/10 text-purple-500",
    },
  ];

  const handleModelToggle = (modelName) => {
    setSelectedModels((prev) => {
      if (prev.includes(modelName)) {
        if (prev.length === 1) {
          toast.error("At least one model must be selected for training.");
          return prev;
        }
        return prev.filter((m) => m !== modelName);
      } else {
        return [...prev, modelName];
      }
    });
  };

  const handleTrain = async () => {
    if (selectedModels.length === 0) {
      toast.error("Please select at least one model to train.");
      return;
    }

    if (!targetColumn) {
      toast.error("Please specify a target column.");
      return;
    }

    setTraining(true);

    try {
      const response = await api.post("/train", {
        dataset_id: datasetId,
        target_column: targetColumn,
        models: selectedModels,
        test_size: parseFloat(testSplit),
        random_state: parseInt(randomState, 10),
      });

      toast.success(
        `Training complete. Best performing model: ${response.data.best_model}`
      );
      navigate(`/compare/${datasetId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Model training failed.");
    } finally {
      setTraining(false);
    }
  };

  if (loadingMeta) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent animate-spin rounded-full" />
        <p className="text-xs font-mono text-muted-foreground">Loading model training configuration...</p>
      </div>
    );
  }

  const numericCols = meta?.numeric_columns || [];

  return (
    <div className="max-w-5xl mx-auto space-y-10 text-left">
      {/* Header Banner */}
      <div className="border-b border-border/80 pb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-semibold mb-2">
          <Cpu className="w-3.5 h-3.5" />
          <span>Stage 3 • AI Model Studio</span>
        </div>
        <h1 className="text-3xl font-heading font-extrabold text-foreground tracking-tight">
          AI Model Studio & Dual-Engine Training
        </h1>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
          Configure held-out evaluation splits and fit high-performance Random Forest and regularized XGBoost models in parallel.
        </p>
      </div>

      {/* Model Selection Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Models to Train & Benchmark</h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-secondary text-muted-foreground">
            {selectedModels.length} of 2 Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {models.map((model) => {
            const isSelected = selectedModels.includes(model.name);
            const Icon = model.icon;
            return (
              <div
                key={model.name}
                onClick={() => handleModelToggle(model.name)}
                className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 relative shadow-sm hover:shadow-xl ${
                  isSelected
                    ? `bg-gradient-to-br ${model.color} scale-[1.01]`
                    : "bg-card border-border hover:border-foreground/30 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${model.iconBg} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {model.tag}
                      </span>
                      <h3 className="text-base font-bold text-foreground mt-0.5">
                        {model.label}
                      </h3>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "border border-border bg-secondary"
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                  {model.desc}
                </p>

                <div className="mt-4 pt-3 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
                  {model.specs}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Training Hyperparameters Panel */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-md">
        <h2 className="text-base font-bold text-foreground border-b border-border/80 pb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-500" />
          <span>Training Hyperparameters</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Target Column */}
          <div className="space-y-1.5">
            <label
              htmlFor="target-column-select"
              className="block text-xs font-bold text-foreground uppercase tracking-wider"
            >
              Target Variable (Y)
            </label>
            <select
              id="target-column-select"
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            >
              {numericCols.map((col) => (
                <option key={col} value={col}>
                  {col} {meta?.suggested_targets?.includes(col) ? "★ (Target Price)" : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Continuous property valuation target
            </p>
          </div>

          {/* Test Split */}
          <div className="space-y-1.5">
            <label
              htmlFor="test-split-input"
              className="block text-xs font-bold text-foreground uppercase tracking-wider"
            >
              Test Split Ratio
            </label>
            <div className="flex items-center gap-2">
              <input
                id="test-split-input"
                type="number"
                min="0.1"
                max="0.4"
                step="0.05"
                value={testSplit}
                onChange={(e) => setTestSplit(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-mono rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all tabular-nums"
              />
              <span className="text-xs font-mono text-muted-foreground whitespace-nowrap font-bold">
                {(testSplit * 100).toFixed(0)}% Held-Out
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Held out for out-of-sample validation
            </p>
          </div>

          {/* Random Seed */}
          <div className="space-y-1.5">
            <label
              htmlFor="random-seed-input"
              className="block text-xs font-bold text-foreground uppercase tracking-wider"
            >
              Reproducibility Seed
            </label>
            <input
              id="random-seed-input"
              type="number"
              value={randomState}
              onChange={(e) => setRandomState(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-mono rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all tabular-nums"
            />
            <p className="text-[11px] text-muted-foreground">
              Deterministic train/test partition seed
            </p>
          </div>
        </div>

        {/* Start Training Action */}
        <div className="pt-4 border-t border-border/80 flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>RobustScaler + OneHotEncoder automatic preprocessing</span>
          </div>

          <button
            onClick={handleTrain}
            disabled={training || selectedModels.length === 0}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 transition-all cursor-pointer"
          >
            {training ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                <span>Fitting Regression Ensembles...</span>
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4" />
                <span>Start Dual Model Training</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Workflow Stage Footer Navigator */}
      <StageFooterNav currentStepId="studio" datasetId={datasetId} />
    </div>
  );
}