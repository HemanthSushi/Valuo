import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  Database,
  BarChart2,
  Table,
  AlertCircle,
  Check,
  Building2,
  Layers,
  Sparkles,
  Target,
  Sliders,
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

export default function EDAPage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [eda, setEda] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [metaRes, edaRes] = await Promise.all([
          api.get(`/meta/${datasetId}`),
          api.get(`/eda/${datasetId}`),
        ]);

        setMeta(metaRes.data);
        setEda(edaRes.data);

        if (metaRes.data.suggested_targets && metaRes.data.suggested_targets.length > 0) {
          setSelectedTarget(metaRes.data.suggested_targets[0]);
        } else if (metaRes.data.numeric_columns.length > 0) {
          setSelectedTarget(metaRes.data.numeric_columns[0]);
        }
      } catch (error) {
        toast.error("Failed to load dataset exploratory analysis.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [datasetId]);

  const handleProceedToTrain = () => {
    if (!selectedTarget) {
      toast.error("Please select a target variable for regression.");
      return;
    }
    navigate(`/train/${datasetId}?target=${selectedTarget}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent animate-spin rounded-full" />
        <p className="text-xs font-mono text-muted-foreground">Computing dataset statistics & correlations...</p>
      </div>
    );
  }

  if (!meta || !eda) {
    return (
      <div className="p-10 text-center bg-card border border-border rounded-2xl max-w-md mx-auto space-y-3">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <h2 className="text-base font-bold text-foreground">Dataset not found</h2>
        <p className="text-xs text-muted-foreground mt-1">Unable to locate workspace records for ID: {datasetId}</p>
      </div>
    );
  }

  const missingData = eda.missing_values
    ? Object.entries(eda.missing_values)
        .filter(([_, val]) => val.count > 0)
        .map(([col, val]) => ({
          column: col,
          count: val.count,
          percent: val.percent,
        }))
        .sort((a, b) => b.count - a.count)
    : [];

  let correlationData = [];
  if (selectedTarget && eda.correlations && eda.correlations[selectedTarget]) {
    correlationData = Object.entries(eda.correlations[selectedTarget])
      .filter(([col]) => col !== selectedTarget)
      .map(([col, corr]) => ({
        feature: col,
        correlation: corr ? parseFloat(corr.toFixed(4)) : 0,
      }))
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
      .slice(0, 10);
  }

  const numericCols = meta.numeric_columns || [];
  const summaryStats = eda.summary_stats || {};

  return (
    <div className="space-y-8 text-left max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-semibold mb-2">
            <Database className="w-3.5 h-3.5" />
            <span>Stage 2 • Data Profiling & Feature Intelligence</span>
          </div>
          <h1 className="text-3xl font-heading font-extrabold text-foreground tracking-tight">
            Data Profiling & Feature Distributions
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Analyzing {meta.rows.toLocaleString()} property records across {meta.columns} distinct dimensions.
          </p>
        </div>

        {/* Target Selector & Proceed Action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary/80 px-3 py-1.5 rounded-xl border border-border">
            <label htmlFor="target-select" className="text-xs font-bold text-muted-foreground whitespace-nowrap">
              Target (Y):
            </label>
            <select
              id="target-select"
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="px-2.5 py-1 text-xs font-bold rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {numericCols.map((col) => (
                <option key={col} value={col}>
                  {col} {meta.suggested_targets.includes(col) ? "★ (Target)" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleProceedToTrain}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer whitespace-nowrap"
          >
            <span>Proceed to Model Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Multi-Colored Feature Breakdown Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-500/10 via-card to-card border border-indigo-500/30 rounded-2xl p-5 shadow-sm card-hover-effect">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3">
            <Building2 className="w-5 h-5" />
          </div>
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Rows</p>
          <p className="text-3xl font-extrabold text-foreground font-heading mt-0.5 tabular-nums">
            {meta.rows.toLocaleString()}
          </p>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-1 block">
            Residential Records
          </span>
        </div>

        <div className="bg-gradient-to-br from-cyan-500/10 via-card to-card border border-cyan-500/30 rounded-2xl p-5 shadow-sm card-hover-effect">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mb-3">
            <Database className="w-5 h-5" />
          </div>
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Numeric Features</p>
          <p className="text-3xl font-extrabold text-cyan-600 dark:text-cyan-400 font-heading mt-0.5 tabular-nums">
            {meta.numeric_columns.length}
          </p>
          <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
            Continuous & Quantities
          </span>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 via-card to-card border border-purple-500/30 rounded-2xl p-5 shadow-sm card-hover-effect">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-3">
            <Layers className="w-5 h-5" />
          </div>
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Categorical Features</p>
          <p className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 font-heading mt-0.5 tabular-nums">
            {meta.categorical_columns.length}
          </p>
          <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
            Locations & Categories
          </span>
        </div>

        <div className="bg-gradient-to-br from-amber-500/10 via-card to-card border border-amber-500/30 rounded-2xl p-5 shadow-sm card-hover-effect">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Missing Values</p>
          <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-heading mt-0.5 tabular-nums">
            {missingData.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
            Auto-Imputed via Pipeline
          </span>
        </div>
      </div>

      {/* Two Column Section: Correlations and Missingness */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Target Correlations Chart */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-border/80 pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Top Feature Correlations with Target</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pearson linear correlation with selected target: <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedTarget}</span>
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-muted-foreground bg-secondary px-2.5 py-1 rounded-md">
              |r| Ranking
            </span>
          </div>

          {correlationData.length > 0 ? (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={correlationData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 75, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[-1, 1]}
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
                    formatter={(val) => [`${val}`, "Pearson Correlation"]}
                  />
                  <Bar
                    dataKey="correlation"
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                  >
                    {correlationData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.correlation >= 0 ? "#222222" : "#88867C"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-16 text-center">
              Insufficient numeric pairs to compute correlation matrix.
            </p>
          )}
        </div>

        {/* Missing Values Table with Progress Bars */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-border/80 pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Missing Values Profile</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Handled via automated median & mode imputation
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {missingData.length} columns affected
            </span>
          </div>

          {missingData.length > 0 ? (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-2.5 text-left font-bold">Feature</th>
                    <th className="py-2.5 text-right font-bold">Count</th>
                    <th className="py-2.5 text-right font-bold">% Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {missingData.map((item) => (
                    <tr key={item.column} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-2.5 font-bold text-foreground">{item.column}</td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground tabular-nums">
                        {item.count.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold font-mono text-[11px]">
                          {item.percent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-foreground">Zero Missing Values Detected</p>
              <p>Dataset is completely dense across all observed rows.</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary Statistics Table */}
      {numericCols.length > 0 && Object.keys(summaryStats).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-border/80 pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Descriptive Numeric Statistics</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Central tendencies, dispersion, and quartiles for continuous features
              </p>
            </div>
            <span className="text-xs font-mono text-muted-foreground bg-secondary px-2.5 py-1 rounded-md font-semibold">
              Standard 5-Number Summary
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 text-left font-bold">Feature</th>
                  <th className="py-3 text-right font-bold">Count</th>
                  <th className="py-3 text-right font-bold">Mean</th>
                  <th className="py-3 text-right font-bold">Std Dev</th>
                  <th className="py-3 text-right font-bold">Min</th>
                  <th className="py-3 text-right font-bold">25%</th>
                  <th className="py-3 text-right font-bold">Median (50%)</th>
                  <th className="py-3 text-right font-bold">75%</th>
                  <th className="py-3 text-right font-bold">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {numericCols.map((col) => {
                  const stat = summaryStats[col] || {};
                  return (
                    <tr key={col} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-2.5 font-bold text-foreground">{col}</td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground tabular-nums">
                        {stat.count ? Number(stat.count).toLocaleString() : "-"}
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground tabular-nums">
                        {stat.mean !== undefined && stat.mean !== null ? Number(stat.mean).toFixed(2) : "-"}
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground tabular-nums">
                        {stat.std !== undefined && stat.std !== null ? Number(stat.std).toFixed(2) : "-"}
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground tabular-nums">
                        {stat.min !== undefined && stat.min !== null ? Number(stat.min).toFixed(2) : "-"}
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground tabular-nums">
                        {stat["25%"] !== undefined && stat["25%"] !== null ? Number(stat["25%"]).toFixed(2) : "-"}
                      </td>
                      <td className="py-2.5 text-right font-mono text-indigo-600 dark:text-indigo-400 font-bold tabular-nums">
                        {stat["50%"] !== undefined && stat["50%"] !== null ? Number(stat["50%"]).toFixed(2) : "-"}
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground tabular-nums">
                        {stat["75%"] !== undefined && stat["75%"] !== null ? Number(stat["75%"]).toFixed(2) : "-"}
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground tabular-nums">
                        {stat.max !== undefined && stat.max !== null ? Number(stat.max).toFixed(2) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Workflow Stage Footer Navigator */}
      <StageFooterNav currentStepId="profiling" datasetId={datasetId} />
    </div>
  );
}