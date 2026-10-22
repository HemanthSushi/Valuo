import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  Sliders,
  Info,
  Zap,
  Sparkles,
  Calculator,
  Target,
  Layers,
  Building2,
  CheckCircle2,
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
  Cell,
} from "recharts";

export default function ExplainabilityPage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [modelData, setModelData] = useState(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [explainability, setExplainability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingExplain, setLoadingExplain] = useState(false);

  useEffect(() => {
    async function loadModels() {
      try {
        const response = await api.get(`/models/${datasetId}`);
        setModelData(response.data);
        if (response.data.best_model) {
          setSelectedModel(response.data.best_model);
        } else if (response.data.models?.length > 0) {
          setSelectedModel(response.data.models[0].model_name);
        }
      } catch (error) {
        toast.error("Failed to load models for explainability.");
      } finally {
        setLoading(false);
      }
    }
    loadModels();
  }, [datasetId]);

  useEffect(() => {
    if (selectedModel) {
      loadExplainability(selectedModel);
    }
  }, [selectedModel]);

  const loadExplainability = async (modelName) => {
    setLoadingExplain(true);
    try {
      const response = await api.get(`/explainability/${datasetId}/${modelName}`);
      setExplainability(response.data);
    } catch (error) {
      toast.error(`Failed to load explainability data for ${modelName}`);
    } finally {
      setLoadingExplain(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent animate-spin rounded-full" />
        <p className="text-xs font-mono text-muted-foreground">Loading explainability vectors...</p>
      </div>
    );
  }

  if (!modelData || !modelData.models) {
    return (
      <div className="p-10 text-center bg-card border border-border rounded-2xl max-w-md mx-auto space-y-4 shadow-md">
        <Sparkles className="w-10 h-10 text-indigo-500 mx-auto" />
        <h2 className="text-base font-bold text-foreground">No Models Available</h2>
        <p className="text-xs text-muted-foreground">Please train models before inspecting feature attributions.</p>
        <button
          onClick={() => navigate(`/train/${datasetId}`)}
          className="px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/25"
        >
          Train Models
        </button>
      </div>
    );
  }

  const featureImportanceData = explainability?.feature_importance
    ? explainability.feature_importance.feature_names.map((name, i) => ({
        feature: name,
        importance: parseFloat((explainability.feature_importance.importances[i] * 100).toFixed(2)),
      })).slice(0, 12)
    : [];

  const shapData = explainability?.shap_values
    ? explainability.shap_values.feature_names.map((name, i) => ({
        feature: name,
        shap: parseFloat(explainability.shap_values.mean_shap_values[i].toFixed(4)),
      })).slice(0, 12)
    : [];

  return (
    <div className="space-y-8 text-left max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-pink-500/10 text-pink-600 dark:text-pink-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Stage 5 • SHAP Insights</span>
          </div>
          <h1 className="text-3xl font-heading font-extrabold text-foreground tracking-tight">
            SHAP Insights & Feature Attribution
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Decode how physical dimensions, localities, and features mathematically drive property price estimations.
          </p>
        </div>

        {/* Model Switcher & Prediction Action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary/80 px-3 py-1.5 rounded-xl border border-border">
            <label htmlFor="explain-model-select" className="text-xs font-bold text-muted-foreground whitespace-nowrap">
              Algorithm:
            </label>
            <select
              id="explain-model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-2.5 py-1 text-xs font-bold rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              data-testid="model-select"
            >
              {modelData.models.map((m) => (
                <option key={m.model_name} value={m.model_name}>
                  {m.model_name} {m.model_name === modelData.best_model ? "★ (Best Model)" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => navigate(`/predict/${datasetId}`)}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Proceed to Valuation Lab</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loadingExplain ? (
        <div className="flex flex-col items-center justify-center h-80 space-y-3 bg-card border border-border rounded-2xl shadow-md">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent animate-spin rounded-full" />
          <p className="text-xs font-mono text-muted-foreground">
            Computing TreeExplainer marginal attributions for {selectedModel}...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Feature Importance Chart */}
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-border/80 pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Global Feature Importance (%)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Relative impurity reduction across decision trees in {selectedModel}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-500">MDI Rank</span>
            </div>

            {featureImportanceData.length > 0 ? (
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={featureImportanceData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 85, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="currentColor"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="feature"
                      type="category"
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
                      formatter={(val) => [`${val}%`, "Global Weight"]}
                    />
                    <Bar
                      dataKey="importance"
                      fill="#222222"
                      radius={[0, 4, 4, 0]}
                      barSize={16}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-20 text-center">
                Feature importance is not available for this model type.
              </p>
            )}
          </div>

          {/* SHAP Mean Values Chart */}
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-border/80 pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Mean |SHAP Value| (Marginal Impact)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Average magnitude of valuation change attributed by TreeExplainer
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#222222]">XAI Impact</span>
            </div>

            {shapData.length > 0 ? (
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={shapData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 85, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="currentColor"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="feature"
                      type="category"
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
                      formatter={(val) => [`${val}`, "Mean |SHAP|"]}
                    />
                    <Bar
                      dataKey="shap"
                      fill="#88867C"
                      radius={[0, 4, 4, 0]}
                      barSize={16}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-20 text-center">
                SHAP explanation values are being calculated or unavailable.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Workflow Stage Footer Navigator */}
      <StageFooterNav currentStepId="insights" datasetId={datasetId} />
    </div>
  );
}