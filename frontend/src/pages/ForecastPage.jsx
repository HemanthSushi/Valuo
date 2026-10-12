import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { TrendingUp, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
    loadData();
  }, [datasetId]);

  const loadData = async () => {
    try {
      const [metaRes, modelsRes] = await Promise.all([
        axios.get(`${API}/meta/${datasetId}`),
        axios.get(`${API}/models/${datasetId}`),
      ]);

      setMeta(metaRes.data);
      setModelData(modelsRes.data);

      if (metaRes.data.datetime_columns.length > 0) {
        setSelectedDateCol(metaRes.data.datetime_columns[0]);
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleForecast = async () => {
    if (!selectedDateCol) {
      toast.error("Please select a date column");
      return;
    }

    setForecasting(true);

    try {
      const response = await axios.post(`${API}/forecast`, {
        dataset_id: datasetId,
        date_column: selectedDateCol,
        target_column: modelData.target_column,
        periods: periods,
        freq: freq,
      });

      setForecast(response.data);
      toast.success("Forecast generated successfully!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Forecasting failed");
    } finally {
      setForecasting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!meta || !modelData) return null;

  if (meta.datetime_columns.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border border-border rounded-none p-12">
          <div className="text-center">
            <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-heading font-bold mb-2">No Date Columns Found</h2>
            <p className="text-muted-foreground">
              This dataset does not contain any datetime columns. Time-series forecasting is only available for datasets with date/time information.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const chartData = forecast
    ? [
        ...forecast.historical_dates.map((date, i) => ({
          date: date,
          actual: forecast.historical_values[i],
          forecast: null,
          lower: null,
          upper: null,
        })),
        ...forecast.forecast_dates.map((date, i) => ({
          date: date,
          actual: null,
          forecast: forecast.forecast_values[i],
          lower: forecast.lower_bound[i],
          upper: forecast.upper_bound[i],
        })),
      ]
    : [];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-heading font-bold text-foreground mb-2">Time-Series Forecasting</h1>
        <p className="text-muted-foreground">Forecast future values using ARIMA model</p>
      </div>

      <Card className="border border-border rounded-none p-6">
        <h2 className="text-xl font-heading font-bold mb-4">Forecast Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label htmlFor="date-column" className="text-sm font-medium mb-2 block">
              Date Column
            </Label>
            <Select value={selectedDateCol} onValueChange={setSelectedDateCol}>
              <SelectTrigger className="w-full rounded-none" data-testid="date-column-select">
                <SelectValue placeholder="Select date column" />
              </SelectTrigger>
              <SelectContent>
                {meta.datetime_columns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="periods" className="text-sm font-medium mb-2 block">
              Forecast Periods
            </Label>
            <Input
              id="periods"
              type="number"
              min="1"
              max="36"
              value={periods}
              onChange={(e) => setPeriods(parseInt(e.target.value))}
              className="rounded-none"
              data-testid="periods-input"
            />
          </div>

          <div>
            <Label htmlFor="frequency" className="text-sm font-medium mb-2 block">
              Frequency
            </Label>
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger className="w-full rounded-none" data-testid="frequency-select">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="D">Daily</SelectItem>
                <SelectItem value="W">Weekly</SelectItem>
                <SelectItem value="M">Monthly</SelectItem>
                <SelectItem value="Q">Quarterly</SelectItem>
                <SelectItem value="Y">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleForecast}
          disabled={forecasting}
          className="w-full mt-6 rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="generate-forecast-button"
        >
          {forecasting ? "Generating Forecast..." : "Generate Forecast"}
        </Button>
      </Card>

      {forecast && (
        <Card className="border border-border rounded-none p-6">
          <div className="flex items-center space-x-3 mb-6">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-heading font-bold">Forecast Results</h2>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 0,
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="lower"
                stackId="1"
                stroke="none"
                fill="hsl(var(--chart-4))"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="upper"
                stackId="1"
                stroke="none"
                fill="hsl(var(--chart-4))"
                fillOpacity={0.3}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={false}
                name="Historical"
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Forecast"
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="mt-6 p-4 bg-muted/30 rounded-none">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> The shaded area represents the 95% confidence interval for the forecast.
              Actual future values are expected to fall within this range with 95% probability.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}