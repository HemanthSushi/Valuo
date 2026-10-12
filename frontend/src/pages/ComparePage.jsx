import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { TrendingUp, Award, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ComparePage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [modelData, setModelData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModels();
  }, [datasetId]);

  const loadModels = async () => {
    try {
      const response = await axios.get(`${API}/models/${datasetId}`);
      setModelData(response.data);
    } catch (error) {
      toast.error("Failed to load model results");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading models...</p>
        </div>
      </div>
    );
  }

  if (!modelData || !modelData.models) return null;

  const bestModel = modelData.models.find((m) => m.model_name === modelData.best_model);

  const chartData = modelData.models.map((model) => ({
    name: model.model_name,
    RMSE: model.rmse,
    MAE: model.mae,
    R2: model.r2,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground mb-2">Model Comparison</h1>
          <p className="text-muted-foreground">Compare performance metrics across all trained models</p>
        </div>
        <Button
          onClick={() => navigate(`/explainability/${datasetId}`)}
          className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="view-explainability-button"
        >
          View Explainability
        </Button>
      </div>

      {bestModel && (
        <Card className="border border-primary/50 rounded-none p-6 bg-primary/5">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-accent rounded-none flex items-center justify-center flex-shrink-0">
              <Award className="w-6 h-6 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
                Best Model: {bestModel.model_name}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">RMSE</p>
                  <p className="text-xl font-mono font-bold text-foreground">{bestModel.rmse.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">MAE</p>
                  <p className="text-xl font-mono font-bold text-foreground">{bestModel.mae.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">R² Score</p>
                  <p className="text-xl font-mono font-bold text-foreground">{bestModel.r2.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Train Time</p>
                  <p className="text-xl font-mono font-bold text-foreground">{bestModel.train_time.toFixed(2)}s</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* CHANGED: Wrapped graphs in a grid to put them side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-border rounded-none p-6">
          <h2 className="text-sm font-heading font-bold mb-4">RMSE Comparison</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 0,
                }}
              />
              <Bar dataKey="RMSE" fill="hsl(var(--chart-1))" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border border-border rounded-none p-6">
          <h2 className="text-sm font-heading font-bold mb-4">R² Score Comparison</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 0,
                }}
              />
              <Bar dataKey="R2" fill="hsl(var(--chart-2))" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="border border-border rounded-none p-6">
        <h2 className="text-xl font-heading font-bold mb-4">Detailed Metrics</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-bold">Model</th>
                <th className="text-right p-3 font-bold">RMSE</th>
                <th className="text-right p-3 font-bold">MAE</th>
                <th className="text-right p-3 font-bold">R²</th>
                <th className="text-right p-3 font-bold">MAPE</th>
                <th className="text-right p-3 font-bold">Train Time (s)</th>
                {modelData.models[0].cv_rmse && <th className="text-right p-3 font-bold">CV RMSE</th>}
              </tr>
            </thead>
            <tbody>
              {modelData.models.map((model) => (
                <tr
                  key={model.model_name}
                  className={`border-b border-border/50 ${
                    model.model_name === modelData.best_model ? "bg-accent/10" : ""
                  }`}
                >
                  <td className="p-3 font-medium">
                    {model.model_name}
                    {model.model_name === modelData.best_model && (
                      <span className="ml-2 text-xs bg-accent text-accent-foreground px-2 py-1 rounded-none">BEST</span>
                    )}
                  </td>
                  <td className="text-right p-3">{model.rmse.toFixed(4)}</td>
                  <td className="text-right p-3">{model.mae.toFixed(4)}</td>
                  <td className="text-right p-3">{model.r2.toFixed(4)}</td>
                  <td className="text-right p-3">{model.mape.toFixed(2)}%</td>
                  <td className="text-right p-3">{model.train_time.toFixed(2)}</td>
                  {model.cv_rmse && <td className="text-right p-3">{model.cv_rmse.toFixed(4)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-between">
        <Button
          onClick={() => navigate(`/predict/${datasetId}`)}
          variant="outline"
          className="rounded-none"
          data-testid="go-to-predict-button"
        >
          Make Predictions
        </Button>
        <Button
          onClick={() => navigate(`/explainability/${datasetId}`)}
          className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
        >
          View Explainability
        </Button>
      </div>
    </div>
  );
}