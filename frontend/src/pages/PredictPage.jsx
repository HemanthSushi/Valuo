import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  TrendingUp, 
  Loader2, 
  Calculator, 
  Bath, 
  Ruler, 
  Grid2X2, 
  Clock,
  ChevronDown,
  ChevronUp
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PredictPage() {
  const { datasetId } = useParams();
  const [modelData, setModelData] = useState(null);
  const [metaData, setMetaData] = useState(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Mapped Columns (to identify the specific fields requested)
  const [mappedCols, setMappedCols] = useState({
    availability: null, // "Ready to move"
    size: null,         // "Size" / "BHK"
    bath: null,         // "Bath"
    balcony: null       // "Balcony"
  });

  useEffect(() => {
    loadData();
  }, [datasetId]);

  const loadData = async () => {
    try {
      const [modelsRes, metaRes] = await Promise.all([
        axios.get(`${API}/models/${datasetId}`),
        axios.get(`${API}/meta/${datasetId}`)
      ]);
      
      setModelData(modelsRes.data);
      setMetaData(metaRes.data);
      setSelectedModel(modelsRes.data.best_model);

      // Attempt to auto-map columns based on names
      const cols = metaRes.data.column_types;
      const mapping = { availability: null, size: null, bath: null, balcony: null };
      
      Object.keys(cols).forEach(col => {
        const lower = col.toLowerCase();
        if (lower.includes('avail') || lower.includes('status')) mapping.availability = col;
        else if (lower.includes('size') || lower.includes('bhk') || lower.includes('bed')) mapping.size = col;
        else if (lower.includes('bath')) mapping.bath = col;
        else if (lower.includes('balcony')) mapping.balcony = col;
      });
      setMappedCols(mapping);

    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (col, value) => {
    setFormData(prev => ({
      ...prev,
      [col]: value
    }));
  };

  const handlePredict = async () => {
    setPredicting(true);
    setPrediction(null);

    // Filter out empty strings to allow backend Imputer to handle them
    const cleanData = {};
    Object.keys(formData).forEach(key => {
        if (formData[key] !== "" && formData[key] !== null) {
            cleanData[key] = formData[key];
        }
    });

    try {
      const response = await axios.post(`${API}/predict`, {
        dataset_id: datasetId,
        model_name: selectedModel,
        rows: [cleanData] 
      });
      setPrediction(response.data.predictions[0]);
      toast.success("Price calculated!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Prediction failed");
    } finally {
      setPredicting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin h-12 w-12 text-primary" />
      </div>
    );
  }

  if (!modelData || !metaData) return null;

  // Helper to render inputs
  const renderField = (colName, label, icon) => {
    if (!colName) return null;
    
    const isCategorical = metaData.column_types[colName] === 'categorical';
    const uniqueVals = metaData.unique_values?.[colName] || [];

    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {icon} {label || colName}
        </Label>
        {isCategorical ? (
          <Select 
            onValueChange={(val) => handleInputChange(colName, val)}
            value={formData[colName] || ""}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder={`Select ${label || colName}`} />
            </SelectTrigger>
            <SelectContent>
              {uniqueVals.map(val => (
                <SelectItem key={val} value={String(val)}>{val}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input 
            type="number" 
            placeholder={`Enter ${label || colName}`}
            value={formData[colName] || ""}
            onChange={(e) => handleInputChange(colName, e.target.value)}
            className="bg-background"
          />
        )}
      </div>
    );
  };

  // Get list of columns that are NOT target and NOT mapped (for advanced section)
  const targetCol = modelData.target_column;
  const mappedValues = Object.values(mappedCols);
  const otherCols = Object.keys(metaData.column_types).filter(c => 
    c !== targetCol && !mappedValues.includes(c)
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Price Predictor</h1>
            <p className="text-muted-foreground">Estimate house prices based on your specifications</p>
        </div>
        <div className="w-64">
             <Label className="mb-1 block text-xs">Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelData.models.map((model) => (
                  <SelectItem key={model.model_name} value={model.model_name}>
                    {model.model_name} {model.model_name === modelData.best_model ? "(Best)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* INPUT FORM */}
        <div className="md:col-span-8 space-y-6">
            <Card className="p-6 border-border rounded-lg shadow-sm">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Grid2X2 className="w-5 h-5 text-primary" /> 
                    Property Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Priority Fields */}
                    {mappedCols.availability ? renderField(mappedCols.availability, "Ready to Move / Availability", <Clock className="w-4 h-4" />) 
                    : <div className="p-4 border border-dashed text-xs text-muted-foreground">Availability column not found</div>}
                    
                    {mappedCols.size ? renderField(mappedCols.size, "Size (BHK)", <Ruler className="w-4 h-4" />) 
                    : <div className="p-4 border border-dashed text-xs text-muted-foreground">Size column not found</div>}
                    
                    {mappedCols.balcony ? renderField(mappedCols.balcony, "Balcony", <Grid2X2 className="w-4 h-4" />) 
                    : <div className="p-4 border border-dashed text-xs text-muted-foreground">Balcony column not found</div>}
                    
                    {mappedCols.bath ? renderField(mappedCols.bath, "Bathrooms", <Bath className="w-4 h-4" />) 
                    : <div className="p-4 border border-dashed text-xs text-muted-foreground">Bath column not found</div>}
                </div>

                {/* Advanced Fields Toggle */}
                {otherCols.length > 0 && (
                    <div className="mt-8">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-muted-foreground"
                        >
                            {showAdvanced ? <ChevronUp className="mr-2 h-4 w-4"/> : <ChevronDown className="mr-2 h-4 w-4"/>}
                            {showAdvanced ? "Hide" : "Show"} Additional Features
                        </Button>
                        
                        {showAdvanced && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2">
                                {otherCols.map(col => renderField(col, col, null))}
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-8">
                    <Button 
                        onClick={handlePredict} 
                        disabled={predicting} 
                        size="lg"
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                    >
                        {predicting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Calculating...
                            </>
                        ) : (
                            <>
                                <Calculator className="mr-2 h-5 w-5" />
                                Calculate Price
                            </>
                        )}
                    </Button>
                </div>
            </Card>
        </div>

        {/* RESULTS PANEL */}
        <div className="md:col-span-4">
            <Card className="h-full border-border bg-muted/20 p-6 flex flex-col justify-center items-center text-center relative overflow-hidden">
                {prediction !== null ? (
                    <div className="animate-in zoom-in duration-300">
                        <div className="inline-flex items-center justify-center p-4 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                            <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Estimated Price(in lakhs)</h2>
                        <div className="text-5xl font-mono font-bold text-foreground tracking-tight">
                            {prediction.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-4 max-w-[200px] mx-auto">
                            Based on the {selectedModel} model and provided parameters.
                        </p>
                    </div>
                ) : (
                    <div className="text-muted-foreground opacity-50">
                        <Calculator className="w-16 h-16 mx-auto mb-4 stroke-1" />
                        <p>Enter property details and calculate to see the price estimate.</p>
                    </div>
                )}
            </Card>
        </div>
      </div>
    </div>
  );
}