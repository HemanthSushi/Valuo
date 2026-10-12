import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Lightbulb, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ExplainabilityPage() {
  const { datasetId } = useParams();
  const [modelData, setModelData] = useState(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [explainability, setExplainability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingExplain, setLoadingExplain] = useState(false);

  useEffect(() => {
    loadModels();
  }, [datasetId]);

  useEffect(() => {
    if (selectedModel) {
      loadExplainability();
    }
  }, [selectedModel]);

  const loadModels = async () => {
    try {
      const response = await axios.get(`${API}/models/${datasetId}`);
      setModelData(response.data);
      setSelectedModel(response.data.best_model);
    } catch (error) {
      toast.error("Failed to load models");
    } finally {
      setLoading(false);
    }
  };

  const loadExplainability = async () => {
    setLoadingExplain(true);
    try {
      const response = await axios.get(`${API}/explainability/${datasetId}/${selectedModel}`);
      setExplainability(response.data);
    } catch (error) {
      toast.error("Failed to load explainability data");
    } finally {
      setLoadingExplain(false);
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

  if (!modelData) return null;

  const featureImportanceData = explainability?.feature_importance
    ? explainability.feature_importance.feature_names.map((name, i) => ({
        feature: name.substring(0, 25),
        importance: explainability.feature_importance.importances[i],
      }))
    : [];

  const shapData = explainability?.shap_values
    ? explainability.shap_values.feature_names.map((name, i) => ({
        feature: name.substring(0, 25),
        shap: explainability.shap_values.mean_shap_values[i],
      }))
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-heading font-bold text-foreground mb-2">Model Explainability</h1>
        <p className="text-muted-foreground">Understand feature importance and SHAP values</p>
      </div>

      <Card className="border border-border rounded-none p-6">
        <h2 className="text-xl font-heading font-bold mb-4">Select Model</h2>
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-full max-w-md rounded-none" data-testid="model-select">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {modelData.models.map((model) => (
              <SelectItem key={model.model_name} value={model.model_name}>
                {model.model_name} {model.model_name === modelData.best_model ? "(Best)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {loadingExplain ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Computing explainability metrics...</p>
          </div>
        </div>
      ) : (
        <>
          {featureImportanceData.length > 0 && (
            <Card className="border border-border rounded-none p-6">
              <div className="flex items-center space-x-3 mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-heading font-bold">Feature Importance</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Top 20 features ranked by their importance in the {selectedModel} model
              </p>
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={featureImportanceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                  <YAxis
                    dataKey="feature"
                    type="category"
                    width={200}
                    tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 0,
                    }}
                  />
                  <Bar dataKey="importance" fill="hsl(var(--chart-1))" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {shapData.length > 0 && (
            <Card className="border border-border rounded-none p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Lightbulb className="w-6 h-6 text-accent" />
                <h2 className="text-xl font-heading font-bold">SHAP Values</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                SHAP (SHapley Additive exPlanations) values show the contribution of each feature to the model predictions
              </p>
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={shapData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                  <YAxis
                    dataKey="feature"
                    type="category"
                    width={200}
                    tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 0,
                    }}
                  />
                  <Bar dataKey="shap" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {!featureImportanceData.length && !shapData.length && (
            <Card className="border border-border rounded-none p-12">
              <div className="text-center">
                <p className="text-muted-foreground">No explainability data available for this model</p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}