import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  TrendingUp,
  Calendar,
  AlertCircle,
  ArrowRight,
  LineChart,
  Sparkles,
  Building2,
  Clock,
  Layers,
  CheckCircle2,
} from "lucide-react";
import api from "@/lib/api";
import { StageFooterNav } from "@/components/PipelineFlowNav";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

export default function ForecastPage() {
  const { datasetId } = useParams();
  const [meta, setMeta] = useState(null);
  const [modelData, setModelData] = useState(null);
  const [selectedDateCol, setSelectedDateCol] = useState("");
  const [periods, setPeriods] = useState(12);
  const [freq, setFreq] = useState("M");
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forecasting, setForecasting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [metaRes, modelsRes] = await Promise.all([
          api.get(`/meta/${datasetId}`),
          api.get(`/models/${datasetId}`).catch(() => ({ data: { target_column: "price" } })),
        ]);

        setMeta(metaRes.data);
        setModelData(modelsRes.data);

        // Strictly check for verified chronological datetime columns
        if (metaRes.data.datetime_columns && metaRes.data.datetime_columns.length > 0) {
          setSelectedDateCol(metaRes.data.datetime_columns[0]);
        } else {
          setSelectedDateCol("");
        }
      } catch (error) {
        toast.error("Failed to load time series metadata.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [datasetId]);

  const handleForecast = async () => {
    if (!selectedDateCol) {
      toast.error("Please select a date or timestamp column for time-series modeling.");
      return;
    }

    setForecasting(true);

    try {
      const response = await api.post("/forecast", {
        dataset_id: datasetId,
        date_column: selectedDateCol,
        target_column: modelData?.target_column || "price",
        periods: parseInt(periods, 10),
        freq: freq,
      });

      setForecast(response.data);
      toast.success("ARIMA time-series projection calculated.");
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Forecasting failed. Verify date column format."
      );
    } finally {
      setForecasting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent animate-spin rounded-full" />
        <p className="text-xs font-mono text-muted-foreground">Checking time-series temporal indices...</p>
      </div>
    );
  }

  if (!meta) {
    return null;
  }

  // Strictly restrict to verified chronological datetime columns
  const allDateOptions = meta.datetime_columns || [];

  // Prepare combined historical + forecast chart data
  let combinedChartData = [];
  if (forecast) {
    const historical = forecast.historical_dates.map((date, i) => ({
      date: date.substring(0, 10),
      historical: parseFloat(forecast.historical_values[i].toFixed(2)),
      forecast: null,
      lower: null,
      upper: null,
    }));

    // Connect last historical point to forecast
    const lastHist = historical[historical.length - 1];

    const projections = forecast.forecast_dates.map((date, i) => ({
      date: date.substring(0, 10),
      historical: i === 0 && lastHist ? lastHist.historical : null,
      forecast: parseFloat(forecast.forecast_values[i].toFixed(2)),
      lower: parseFloat(forecast.lower_bound[i].toFixed(2)),
      upper: parseFloat(forecast.upper_bound[i].toFixed(2)),
    }));

    combinedChartData = [...historical, ...projections];
  }

  return (
    <div className="space-y-8 text-left max-w-7xl mx-auto">
      {/* Visual Header Banner with Skyline Image Overlay */}
      <div className="relative rounded-3xl overflow-hidden bg-card border border-primary/25 shadow-2xl p-8 sm:p-10">
        <img
          src="/images/skyline-apartments.jpg"
          alt="Market Trends Horizon"
          className="absolute inset-0 w-full h-full object-cover opacity-30 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent"></div>

        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30 text-xs font-semibold text-indigo-300">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>Stage 7 • Market Trends (ARIMA)</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-heading tracking-tight">
            Market Trends & Predictive Forecast
          </h1>

          <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
            Analyze historical residential price trajectories and forecast future valuation appreciation
            with 95% parametric confidence intervals.
          </p>
        </div>
      </div>

      {allDateOptions.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-card border border-border rounded-3xl max-w-2xl mx-auto space-y-5 shadow-xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground font-heading">
              Cross-Sectional Dataset Notice: Time-Series Forecasting Unavailable
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
              The active dataset (<strong className="text-foreground font-semibold">{meta.filename || "Bengaluru Housing"}</strong>) is a 
              cross-sectional inventory of residential property records with static spatial and architectural attributes.
              It contains <strong className="text-foreground">no chronological time dimension</strong>.
            </p>
          </div>

          <div className="p-4 bg-muted/40 rounded-2xl border border-border/80 text-left text-xs space-y-2 max-w-lg mx-auto">
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">Why ARIMA is disabled:</strong> Cross-sectional observations represent independent static listings rather than sequential temporal snapshots. Pseudo-date fields (such as <em>availability</em>) contain predominantly static text (&quot;Ready To Move&quot;) and drop &gt;80% of rows when parsed as dates, causing invalid, unverified ARIMA fits.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">How to enable forecasting:</strong> Upload a dedicated time-stamped transaction or index dataset with valid sequential dates (e.g., monthly sales index or repeated sales transactions).
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all cursor-pointer"
            >
              <span>Upload Time-Series Dataset</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to={`/predict/${datasetId}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold border border-border transition-all"
            >
              <span>Go to Valuation Engine</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Configuration Panel */}
          <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-md">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span>Forecast Configuration</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Configure temporal index and forward projection intervals.
              </p>
            </div>

            {/* Date Column */}
            <div className="space-y-1.5">
              <label htmlFor="forecast-date-select" className="block text-xs font-bold text-foreground uppercase tracking-wider">
                Date Column Index
              </label>
              <select
                id="forecast-date-select"
                value={selectedDateCol}
                onChange={(e) => setSelectedDateCol(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              >
                <option value="">Select date feature...</option>
                {allDateOptions.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {/* Forecast Periods */}
            <div className="space-y-1.5">
              <label htmlFor="forecast-periods-input" className="block text-xs font-bold text-foreground uppercase tracking-wider">
                Projection Horizon (Periods)
              </label>
              <input
                id="forecast-periods-input"
                type="number"
                min="1"
                max="60"
                value={periods}
                onChange={(e) => setPeriods(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-mono rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                Number of forward periods to project (e.g. 6 to 24 months)
              </p>
            </div>

            {/* Frequency */}
            <div className="space-y-1.5">
              <label htmlFor="forecast-freq-select" className="block text-xs font-bold text-foreground uppercase tracking-wider">
                Resampling Frequency
              </label>
              <select
                id="forecast-freq-select"
                value={freq}
                onChange={(e) => setFreq(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              >
                <option value="M">Monthly (M)</option>
                <option value="Q">Quarterly (Q)</option>
                <option value="Y">Annual (Y)</option>
                <option value="D">Daily (D)</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                onClick={handleForecast}
                disabled={!selectedDateCol || forecasting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 transition-all cursor-pointer"
              >
                {forecasting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                    <span>Fitting ARIMA Time-Series Model...</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    <span>Generate Forecast</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Visualization Area */}
          <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Historical Trajectory & Projection Band</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Blue line indicates recorded market values; emerald line indicates projected trajectory with 95% bounds.
                </p>
              </div>

              {forecast && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <span>Historical</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>Projection</span>
                  </div>
                </div>
              )}
            </div>

            {forecast ? (
              <div className="space-y-6">
                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={combinedChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "currentColor" }}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "currentColor" }}
                        tickLine={false}
                        domain={["auto", "auto"]}
                        unit=" L"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#DCDCCA",
                          border: "1px solid #88867C",
                          borderRadius: "12px",
                          fontSize: "12px",
                          color: "#222222",
                        }}
                      />
                      {/* Confidence bounds */}
                      <Line
                        type="monotone"
                        dataKey="upper"
                        stroke="#88867C"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        dot={false}
                        name="Upper 95% Bound"
                      />
                      <Line
                        type="monotone"
                        dataKey="lower"
                        stroke="#88867C"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        dot={false}
                        name="Lower 95% Bound"
                      />
                      {/* Historical series */}
                      <Line
                        type="monotone"
                        dataKey="historical"
                        stroke="#88867C"
                        strokeWidth={2.5}
                        dot={{ r: 2, fill: "#88867C" }}
                        name="Historical Valuation"
                      />
                      {/* Forecast series */}
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#222222"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#222222" }}
                        name="ARIMA Forecast"
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary Metric Strip & Statistical Diagnostics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border/80 text-xs">
                  <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Historical Mean</span>
                    <span className="font-mono font-bold text-base text-foreground mt-0.5 block">
                      ₹{(forecast.historical_values.reduce((a, b) => a + b, 0) / forecast.historical_values.length).toFixed(2)} L
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Projected End Value</span>
                    <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      ₹{forecast.forecast_values[forecast.forecast_values.length - 1].toFixed(2)} L
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Stationarity (ADF Test)</span>
                    <span className={`font-mono font-bold text-xs mt-1 block ${forecast.stationarity?.is_stationary ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {forecast.stationarity?.is_stationary ? 'Stationary (p < 0.05)' : `Diff Order d = ${forecast.stationarity?.differencing_order ?? 1}`}
                    </span>
                    {forecast.stationarity?.p_value !== undefined && (
                      <span className="text-[9px] text-muted-foreground block font-mono">
                        ADF p-val: {forecast.stationarity.p_value}
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">ARIMA Model Order</span>
                    <span className="font-mono font-bold text-xs text-indigo-500 mt-1 block">
                      ARIMA({(forecast.stationarity?.selected_order || [1, 1, 1]).join(', ')})
                    </span>
                    {forecast.stationarity?.aic !== undefined && (
                      <span className="text-[9px] text-muted-foreground block font-mono">
                        AIC: {forecast.stationarity.aic}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-muted-foreground space-y-2">
                <LineChart className="w-10 h-10 text-indigo-500 mx-auto opacity-70" />
                <p className="font-bold text-foreground">No Time-Series Forecast Generated Yet</p>
                <p>Select your date column on the left and click &quot;Generate Forecast&quot; to project temporal pricing.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workflow Stage Footer Navigator */}
      <StageFooterNav currentStepId="trends" datasetId={datasetId} />
    </div>
  );
}