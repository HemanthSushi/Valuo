import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowRight, Database, AlertCircle, BarChart3, Hash, Type } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function EDAPage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [eda, setEda] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [datasetId]);

  const loadData = async () => {
    try {
      const [metaRes, edaRes] = await Promise.all([
        axios.get(`${API}/meta/${datasetId}`),
        axios.get(`${API}/eda/${datasetId}`),
      ]);

      setMeta(metaRes.data);
      setEda(edaRes.data);
      
      // Auto-select the first suggested target if available
      if (metaRes.data.suggested_targets && metaRes.data.suggested_targets.length > 0) {
        setSelectedTarget(metaRes.data.suggested_targets[0]);
      } else if (metaRes.data.numeric_columns.length > 0) {
        setSelectedTarget(metaRes.data.numeric_columns[0]);
      }
    } catch (error) {
      console.error("EDA Load Error:", error);
      toast.error("Failed to load dataset");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToTrain = () => {
    if (!selectedTarget) {
      toast.error("Please select a target column");
      return;
    }
    navigate(`/train/${datasetId}?target=${selectedTarget}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dataset...</p>
        </div>
      </div>
    );
  }

  // Safety check: ensure both meta and eda are loaded before rendering
  if (!meta || !eda) return null;

  // SAFE ACCESS 1: Handle Missing Values safely
  const missingData = eda.missing_values 
    ? Object.entries(eda.missing_values)
        .filter(([_, val]) => val.count > 0)
        .map(([col, val]) => ({ column: col, count: val.count, percent: val.percent }))
    : [];

  // SAFE ACCESS 2: Handle Correlations safely
  let correlationData = [];
  if (selectedTarget && eda.correlations && eda.correlations[selectedTarget]) {
      correlationData = Object.entries(eda.correlations[selectedTarget])
        .filter(([col]) => col !== selectedTarget)
        .map(([col, corr]) => ({ feature: col.substring(0, 15), correlation: corr }))
        .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
        .slice(0, 10);
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Exploratory Analysis</h1>
          <p className="text-sm text-muted-foreground">Overview of {meta.rows} rows × {meta.columns} columns</p>
        </div>
        <Button
          onClick={handleProceedToTrain}
          size="sm"
          className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Proceed to Training
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Target Selection */}
      <Card className="border border-border rounded-none p-4 bg-muted/20">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold whitespace-nowrap">Target Column:</h2>
          <Select value={selectedTarget} onValueChange={setSelectedTarget}>
            <SelectTrigger className="w-full max-w-xs h-8 bg-background border-muted-foreground/30 rounded-none text-xs">
              <SelectValue placeholder="Select target" />
            </SelectTrigger>
            <SelectContent>
              {meta.numeric_columns.map((col) => (
                <SelectItem key={col} value={col}>
                  {col} {meta.suggested_targets?.includes(col) ? "(Suggested)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* UPDATED STATS CARDS:
         - grid-cols-2 md:grid-cols-4: Forces 2 per row on small screens, 4 on large.
         - p-4: Reduced padding (was p-6).
         - h-4 w-4: Smaller icons (was w-8 h-8).
      */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border border-border rounded-none p-4 flex flex-col justify-between hover:bg-muted/10 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Rows</p>
            <Database className="h-4 w-4 text-primary opacity-70" />
          </div>
          <p className="text-2xl font-bold font-mono">{meta.rows?.toLocaleString() || 0}</p>
        </Card>
        
        <Card className="border border-border rounded-none p-4 flex flex-col justify-between hover:bg-muted/10 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Numeric</p>
            <Hash className="h-4 w-4 text-green-600 opacity-70" />
          </div>
          <p className="text-2xl font-bold font-mono">{meta.numeric_columns?.length || 0}</p>
        </Card>
        
        <Card className="border border-border rounded-none p-4 flex flex-col justify-between hover:bg-muted/10 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categorical</p>
            <Type className="h-4 w-4 text-blue-600 opacity-70" />
          </div>
          <p className="text-2xl font-bold font-mono">{meta.categorical_columns?.length || 0}</p>
        </Card>
        
        <Card className="border border-border rounded-none p-4 flex flex-col justify-between hover:bg-muted/10 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Missing</p>
            <AlertCircle className={`h-4 w-4 ${missingData.length > 0 ? 'text-destructive' : 'text-muted-foreground'} opacity-70`} />
          </div>
          <p className="text-2xl font-bold font-mono">{missingData.length}</p>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Missing Values Chart */}
        {missingData.length > 0 && (
          <Card className="border border-border rounded-none p-4">
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" /> Missing Values Distribution
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={missingData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="column" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="percent" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Correlations Chart */}
        {correlationData.length > 0 ? (
          <Card className={`border border-border rounded-none p-4 ${missingData.length === 0 ? 'col-span-1 lg:col-span-2' : ''}`}>
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Top Correlations (Target: {selectedTarget})
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={correlationData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[-1, 1]} hide />
                <YAxis dataKey="feature" type="category" width={100} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="correlation" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        ) : (
          <Card className="border border-border rounded-none p-6 flex flex-col items-center justify-center h-[300px] bg-muted/20 col-span-1 lg:col-span-2">
             <BarChart3 className="w-8 h-8 text-muted-foreground/40 mb-2" />
             <p className="text-sm text-muted-foreground">No numeric correlations available</p>
          </Card>
        )}
      </div>

      {/* Summary Statistics Table */}
      {eda.summary_stats && Object.keys(eda.summary_stats).length > 0 && (
        <Card className="border border-border rounded-none p-4">
          <h2 className="text-sm font-bold mb-4">Summary Statistics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 font-bold text-muted-foreground">STAT</th>
                  {Object.keys(eda.summary_stats).slice(0, 8).map((col) => (
                    <th key={col} className="text-right p-2 font-bold text-foreground">{col.substring(0, 12)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['mean', 'std', 'min', '50%', 'max'].map((stat) => (
                  <tr key={stat} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="p-2 font-semibold text-muted-foreground uppercase">{stat}</td>
                    {Object.keys(eda.summary_stats).slice(0, 8).map((col) => (
                      <td key={col} className="text-right p-2">
                        {eda.summary_stats[col][stat] !== undefined && eda.summary_stats[col][stat] !== null 
                            ? eda.summary_stats[col][stat].toFixed(1) 
                            : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}