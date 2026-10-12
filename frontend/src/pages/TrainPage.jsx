import React, { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowRight, Loader2, CheckCircle2, Cpu, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TrainPage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetFromUrl = searchParams.get("target");

  // Default all models to selected for "Automatic" feel
  const [selectedModels, setSelectedModels] = useState([
    "LinearRegression",
    "RandomForest",
    "XGBoost",
    "LightGBM",
  ]);
  const [training, setTraining] = useState(false);

  const models = [
    { 
      name: "LinearRegression", 
      label: "Linear Regression", 
      desc: "Fast, interpretable baseline." 
    },
    { 
      name: "RandomForest", 
      label: "Random Forest", 
      desc: "Robust, handles non-linear data well." 
    },
    { 
      name: "XGBoost", 
      label: "XGBoost", 
      desc: "High performance gradient boosting." 
    },
    { 
      name: "LightGBM", 
      label: "LightGBM", 
      desc: "Fast training, high efficiency." 
    },
  ];

  const handleModelToggle = (modelName) => {
    setSelectedModels((prev) =>
      prev.includes(modelName)
        ? prev.filter((m) => m !== modelName)
        : [...prev, modelName]
    );
  };

  const handleAutoTrain = async () => {
    if (selectedModels.length === 0) {
      toast.error("Please select at least one model");
      return;
    }

    if (!targetFromUrl) {
      toast.error("Target column not specified");
      return;
    }

    setTraining(true);

    try {
      // ✅ We hardcode standard defaults here for "Auto" mode
      const response = await axios.post(`${API}/train`, {
        dataset_id: datasetId,
        target_column: targetFromUrl,
        models: selectedModels,
        test_size: 0.2,     // Standard Default
        random_state: 42,   // Standard Default
        cv_folds: 5,        // Auto-enable 5-fold CV for robust results
      });

      toast.success(`Training complete! Best model: ${response.data.best_model}`);
      navigate(`/compare/${datasetId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Training failed");
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-10">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
          <Cpu className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-heading font-bold text-foreground">
          Auto-Train Models
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Select the algorithms you want to utilize. We will automatically configure hyperparameters, 
          split the data, and run cross-validation to find the best results.
        </p>
        {targetFromUrl && (
          <div className="inline-block bg-accent/20 text-accent-foreground px-4 py-1.5 rounded-full text-sm font-medium font-mono">
            Target Variable: {targetFromUrl}
          </div>
        )}
      </div>

      {/* Model Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        {models.map((model) => {
          const isSelected = selectedModels.includes(model.name);
          return (
            <div
              key={model.name}
              onClick={() => handleModelToggle(model.name)}
              className={`
                relative p-6 cursor-pointer transition-all duration-200 border-2 rounded-xl group
                ${isSelected 
                  ? "border-primary bg-primary/5 shadow-md" 
                  : "border-border bg-card hover:border-primary/50"
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`
                    p-2 rounded-lg transition-colors
                    ${isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground"}
                  `}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{model.label}</h3>
                    <p className="text-sm text-muted-foreground">{model.desc}</p>
                  </div>
                </div>
                
                {/* Checkbox Indicator */}
                <div className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                  ${isSelected ? "border-primary bg-primary text-white" : "border-muted-foreground/30"}
                `}>
                  {isSelected && <CheckCircle2 className="w-4 h-4" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center pt-8">
        <Button
          onClick={handleAutoTrain}
          disabled={training || selectedModels.length === 0}
          size="lg"
          className="w-full md:w-1/2 h-14 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          {training ? (
            <>
              <Loader2 className="w-6 h-6 mr-2 animate-spin" />
              Running AutoML Process...
            </>
          ) : (
            <>
              Start Auto-Training
              <ArrowRight className="w-6 h-6 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}