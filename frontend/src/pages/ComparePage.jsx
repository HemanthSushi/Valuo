import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Award,
  ArrowRight,
  TrendingUp,
  Sliders,
  CheckCircle2,
  BarChart3,
  Sparkles,
  Zap,
  Target,
  Clock,
  Layers,
  Calculator,
} from "lucide-react";
import api from "@/lib/api";
import { StageFooterNav } from "@/components/PipelineFlowNav";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function ComparePage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [modelData, setModelData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadModels() {
      try {
        const response = await api.get(`/models/${datasetId}`);
        setModelData(response.data);
      } catch (error) {
        toast.error("Failed to load trained model results. Please train models first.");
      } finally {
        setLoading(false);
      }
    }
    loadModels();
  }, [datasetId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent animate-spin rounded-full" />
        <p className="text-xs font-mono text-muted-foreground">Loading model leaderboard & evaluation metrics...</p>
      </div>
    );
  }

  if (!modelData || !modelData.models || modelData.models.length === 0) {
    return (
      <div className="p-10 text-center bg-card border border-border rounded-2xl max-w-md mx-auto space-y-4 shadow-md">
        <BarChart3 className="w-10 h-10 text-indigo-500 mx-auto" />
        <h2 className="text-base font-bold text-foreground">No Trained Models Available</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Please run model training for this workspace before viewing comparison metrics.
        </p>
        <button
          onClick={() => navigate(`/train/${datasetId}`)}
          className="px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/25"
        >
          Go to Model Training
        </button>
      </div>
    );
  }

  const bestModel =
    modelData.models.find((m) => m.model_name === modelData.best_model) ||
    modelData.models[0];

  const chartData = modelData.models.map((model) => ({
    name: model.model_name,
    RMSE: parseFloat(model.rmse.toFixed(2)),
    MAE: parseFloat(model.mae.toFixed(2)),
    R2: parseFloat((model.r2 * 100).toFixed(1)),
    isBest: model.model_name === modelData.best_model,
  }));

  return (
    <div className="space-y-8 text-left max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-2">
            <Award className="w-3.5 h-3.5" />
            <span>Stage 4 • Model Leaderboard</span>
          </div>
          <h1 className="text-3xl font-heading font-extrabold text-foreground tracking-tight">
            Model Benchmarks & Leaderboard
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Comparing out-of-sample held-out validation accuracy across Random Forest and XGBoost regression algorithms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate(`/explainability/${datasetId}`)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-all cursor-pointer"
            data-testid="view-explainability-button"
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-500" />
            <span>SHAP Feature Importance</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => navigate(`/predict/${datasetId}`)}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Run Valuation Predictions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Winning Model Hero Banner */}
      {bestModel && (
        <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-emerald-500/15 via-indigo-500/5 to-transparent border border-emerald-500/30 shadow-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider">
                    Winning Model
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    Lowest Prediction Error
                  </span>
                </div>
                <h2 className="text-xl font-bold font-heading text-foreground mt-0.5">
                  {bestModel.model_name} Regressor
                </h2>
              </div>
            </div>

            <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-card/80 border border-border text-muted-foreground">
              Evaluated on {((modelData.test_size || 0.2) * 100).toFixed(0)}% Held-Out Split
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-left">
            <div className="p-3 rounded-xl bg-card/80 border border-border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Root Mean Sq. Error (RMSE)</p>
              <p className="text-2xl font-bold font-heading text-foreground mt-1 tabular-nums">
                {bestModel.rmse.toFixed(3)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-card/80 border border-border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Mean Abs. Error (MAE)</p>
              <p className="text-2xl font-bold font-heading text-foreground mt-1 tabular-nums">
                {bestModel.mae.toFixed(3)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-card/80 border border-emerald-500/30">
              <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">R² Coefficient</p>
              <p className="text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {(bestModel.r2 * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-card/80 border border-border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">MAPE Percentage</p>
              <p className="text-2xl font-bold font-heading text-foreground mt-1 tabular-nums">
                {(bestModel.mape * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-card/80 border border-border">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Training Time</p>
              <p className="text-2xl font-bold font-heading text-foreground mt-1 tabular-nums">
                {bestModel.train_time.toFixed(2)}s
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table & Comparison Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Leaderboard Table */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-border/80 pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Algorithm Leaderboard</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ranked by validation error and explained variance score.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-secondary text-muted-foreground">
              {modelData.models.length} Ensembles Benchmarked
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 text-left font-bold">Algorithm</th>
                  <th className="py-3 text-right font-bold">RMSE</th>
                  <th className="py-3 text-right font-bold">MAE</th>
                  <th className="py-3 text-right font-bold">R² Accuracy</th>
                  <th className="py-3 text-right font-bold">MAPE</th>
                  <th className="py-3 text-right font-bold">Latency</th>
                  <th className="py-3 text-center font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {modelData.models.map((model) => {
                  const isBest = model.model_name === modelData.best_model;
                  return (
                    <tr
                      key={model.model_name}
                      className={`hover:bg-secondary/40 transition-colors ${
                        isBest ? "bg-emerald-500/5 font-semibold" : ""
                      }`}
                    >
                      <td className="py-3 font-bold text-foreground flex items-center gap-2">
                        <span>{model.model_name}</span>
                        {isBest && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider">
                            BEST
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-foreground">
                        {model.rmse.toFixed(3)}
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-foreground">
                        {model.mae.toFixed(3)}
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                        {(model.r2 * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-foreground">
                        {(model.mape * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-muted-foreground">
                        {model.train_time.toFixed(2)}s
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Multi-Colored Bar Chart */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-border/80 pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Error Metric Comparison</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Side-by-side comparison of RMSE and MAE across candidates.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-500">Dual Core</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="currentColor"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="currentColor"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#DCDCCA",
                    borderColor: "#88867C",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#222222",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "10px", color: "#222222" }}
                />
                <Bar dataKey="RMSE" fill="#222222" radius={[4, 4, 0, 0]} barSize={26} name="RMSE Error" />
                <Bar dataKey="MAE" fill="#88867C" radius={[4, 4, 0, 0]} barSize={26} name="MAE Error" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Workflow Stage Footer Navigator */}
      <StageFooterNav currentStepId="leaderboard" datasetId={datasetId} />
    </div>
  );
}