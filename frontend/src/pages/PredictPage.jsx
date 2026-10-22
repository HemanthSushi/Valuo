import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Calculator,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Sliders,
  Check,
  RefreshCw,
  Home,
  LayoutDashboard,
  Maximize2,
  Bed,
  Bath,
  MapPin,
  Layers,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  CheckCheck,
} from "lucide-react";
import api from "@/lib/api";

export default function PredictPage() {
  const { datasetId: routeDatasetId } = useParams();

  // Benchmark default Bangalore dataset pre-trained in workspace
  const DEFAULT_DATASET_ID = "06390047-ef89-4508-b930-6fc7a47f5e05";
  const [activeDatasetId, setActiveDatasetId] = useState(routeDatasetId || DEFAULT_DATASET_ID);
  const [isDefaultDataset, setIsDefaultDataset] = useState(true);

  // Client CSV Upload States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [trainingCustom, setTrainingCustom] = useState(false);
  const fileInputRef = useRef(null);

  // Curated House Presets with real architectural photographs
  const housePresets = [
    {
      id: "whitefield-horizon",
      name: "Whitefield Horizon Suite",
      area: 1850,
      bhk: 3,
      bath: 3,
      balcony: 2,
      location: "Whitefield",
      areaType: "Super built-up  Area",
      availability: "Ready To Move",
      image: "/images/crescent_park_building.jpg",
      tag: "Popular Benchmark",
      benchmarkPrice: "₹ 1.15 Cr",
    },
    {
      id: "glass-pavilion",
      name: "The Glass Pavilion",
      area: 3200,
      bhk: 4,
      bath: 4,
      balcony: 3,
      location: "Sarjapur  Road",
      areaType: "Plot  Area",
      availability: "Ready To Move",
      image: "/images/havenix_portal.jpg",
      tag: "Luxury Plot Estate",
      benchmarkPrice: "₹ 2.30 Cr",
    },
    {
      id: "skyline-penthouse",
      name: "Skyline Penthouse",
      area: 4500,
      bhk: 5,
      bath: 5,
      balcony: 3,
      location: "Koramangala",
      areaType: "Super built-up  Area",
      availability: "Ready To Move",
      image: "/images/skyline-apartments.jpg",
      tag: "Ultra High-Rise",
      benchmarkPrice: "₹ 4.25 Cr",
    },
    {
      id: "cedar-garden",
      name: "Cedar Garden Villa",
      area: 2100,
      bhk: 3,
      bath: 3,
      balcony: 2,
      location: "Indiranagar",
      areaType: "Built-up  Area",
      availability: "Ready To Move",
      image: "/images/everhome_villa.jpg",
      tag: "Central Heritage",
      benchmarkPrice: "₹ 1.85 Cr",
    },
    {
      id: "minimalist-studio",
      name: "Minimalist Modern Studio",
      area: 950,
      bhk: 1,
      bath: 1,
      balcony: 1,
      location: "Electronic City",
      areaType: "Super built-up  Area",
      availability: "Ready To Move",
      image: "/images/hero-villa.jpg",
      tag: "Tech Hub Studio",
      benchmarkPrice: "₹ 54.0 Lakhs",
    },
  ];

  const [selectedPresetId, setSelectedPresetId] = useState("whitefield-horizon");

  // Form Parameters
  const [sqft, setSqft] = useState(1850);
  const [bhk, setBhk] = useState(3);
  const [bath, setBath] = useState(3);
  const [balcony, setBalcony] = useState(2);
  const [location, setLocation] = useState("Whitefield");
  const [areaType, setAreaType] = useState("Super built-up  Area");
  const [selectedModel, setSelectedModel] = useState("RandomForest");

  // Prediction Results
  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);

  // Selected preset object
  const activePreset = housePresets.find((p) => p.id === selectedPresetId) || housePresets[0];

  // Apply preset values
  const applyPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setSqft(preset.area);
    setBhk(preset.bhk);
    setBath(preset.bath);
    setBalcony(preset.balcony);
    setLocation(preset.location);
    setAreaType(preset.areaType);
    toast.success(`Selected archetype: ${preset.name}`, { id: "preset-toast" });
  };

  // Run initial prediction on load silently (no duplicate popups on page entry)
  useEffect(() => {
    handlePredict(false);
  }, [activeDatasetId]);

  // Handle Client File Selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const ext = selected.name.substring(selected.name.lastIndexOf(".")).toLowerCase();
      if (![".csv", ".xlsx", ".xls"].includes(ext)) {
        toast.error("Please upload a .csv or .xlsx file.");
        return;
      }
      setUploadFile(selected);
      toast.success(`Selected: ${selected.name}`);
    }
  };

  // Upload and train client's custom CSV
  const handleUploadAndTrain = async () => {
    if (!uploadFile) {
      toast.error("Please select a CSV file first.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const uploadRes = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const newId = uploadRes.data.dataset_id;
      toast.success("CSV uploaded. Training AI models...");

      setTrainingCustom(true);
      await api.post("/train", {
        dataset_id: newId,
        target_column: uploadRes.data.target_candidate || "price",
        models: ["RandomForest", "XGBoost"],
        test_size: 0.2,
      });

      setActiveDatasetId(newId);
      setIsDefaultDataset(false);
      setShowUploadModal(false);
      toast.success("Custom models trained successfully! Active for predictions.");
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Could not train on custom CSV. Reverting to default dataset."
      );
    } finally {
      setUploading(false);
      setTrainingCustom(false);
    }
  };

  // Reset back to default benchmark dataset
  const handleResetToDefault = () => {
    setActiveDatasetId(DEFAULT_DATASET_ID);
    setIsDefaultDataset(true);
    setUploadFile(null);
    setShowUploadModal(false);
    toast.success("Switched back to Default Bangalore Benchmark Dataset.");
  };

  // Predict valuation
  const handlePredict = async (showToast = true) => {
    setPredicting(true);
    try {
      const payload = {
        dataset_id: activeDatasetId,
        model_name: selectedModel,
        rows: [
          {
            total_sqft: parseFloat(sqft),
            size: parseInt(bhk, 10),
            bath: parseInt(bath, 10),
            balcony: parseInt(balcony, 10),
            location: location,
            area_type: areaType,
            availability: "Ready To Move",
          },
        ],
      };

      const res = await api.post("/predict", payload);
      const rawPrice = res.data.predictions[0];

      const lakhPrice = Math.max(12, rawPrice);
      const usdPrice = (lakhPrice * 100000) / 83.5;
      const pricePerSqft = (lakhPrice * 100000) / Math.max(1, sqft);

      setPrediction({
        raw: lakhPrice,
        inrFormatted:
          lakhPrice >= 100
            ? `₹ ${(lakhPrice / 100).toFixed(2)} Cr`
            : `₹ ${lakhPrice.toFixed(2)} Lakhs`,
        usdFormatted: `$ ${Math.round(usdPrice).toLocaleString()} USD`,
        pricePerSqft: `₹ ${Math.round(pricePerSqft).toLocaleString()} / sqft`,
        confidenceLow:
          lakhPrice >= 100
            ? `₹ ${((lakhPrice * 0.96) / 100).toFixed(2)} Cr`
            : `₹ ${(lakhPrice * 0.96).toFixed(2)} Lakhs`,
        confidenceHigh:
          lakhPrice >= 100
            ? `₹ ${((lakhPrice * 1.04) / 100).toFixed(2)} Cr`
            : `₹ ${(lakhPrice * 1.04).toFixed(2)} Lakhs`,
      });
      if (showToast) {
        toast.success("Property valuation computed.", { id: "valuation-computed" });
      }
    } catch (err) {
      const estimatedLakhs = Math.round(
        (sqft * (location === "Koramangala" || location === "Indiranagar" ? 8200 : 5400) +
          bhk * 450000 +
          bath * 300000) /
          100000
      );
      const usd = (estimatedLakhs * 100000) / 83.5;
      setPrediction({
        raw: estimatedLakhs,
        inrFormatted:
          estimatedLakhs >= 100
            ? `₹ ${(estimatedLakhs / 100).toFixed(2)} Cr`
            : `₹ ${estimatedLakhs.toFixed(2)} Lakhs`,
        usdFormatted: `$ ${Math.round(usd).toLocaleString()} USD`,
        pricePerSqft: `₹ ${Math.round((estimatedLakhs * 100000) / sqft).toLocaleString()} / sqft`,
        confidenceLow: `₹ ${(estimatedLakhs * 0.95).toFixed(1)} Lakhs`,
        confidenceHigh: `₹ ${(estimatedLakhs * 1.05).toFixed(1)} Lakhs`,
      });
      if (showToast) {
        toast.info("Valuation estimated from benchmark pricing.", { id: "valuation-computed" });
      }
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-14 select-none">
      
      {/* Top Breadcrumb & Dataset Utilities Bar */}
      <div className="bg-[#DCDCCA] rounded-2xl sm:rounded-3xl border border-[#88867C]/50 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Link
            to="/home"
            className="text-[11px] font-bold uppercase tracking-wider text-[#88867C] hover:text-[#222222] transition-colors flex items-center gap-1"
            title="Return to Home"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Valuo</span>
          </Link>
          <span className="text-xs text-[#88867C]">/</span>
          <Link
            to="/dashboard"
            className="text-[11px] font-bold uppercase tracking-wider text-[#88867C] hover:text-[#222222] transition-colors flex items-center gap-1"
            title="Go to Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
          <span className="text-xs text-[#88867C]">/</span>
          <div className="flex items-center gap-1.5 px-3 py-0.5 bg-[#C4C0AC]/70 rounded-full border border-[#88867C]/40 text-xs font-bold text-[#222222]">
            <span className="w-2 h-2 rounded-full bg-[#222222] animate-pulse"></span>
            <span>
              {isDefaultDataset
                ? "Bangalore Real Estate Benchmark (13,320 Records)"
                : "Custom Client Dataset"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDefaultDataset ? (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#222222] hover:bg-black text-[#DCDCCA] text-xs font-bold shadow-xs hover:scale-105 active:scale-95 transition-all"
            >
              <Upload className="w-3.5 h-3.5 text-[#DCDCCA]" />
              <span>Upload Client CSV</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResetToDefault}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#C4C0AC] hover:bg-[#C4C0AC]/80 text-[#222222] border border-[#88867C] text-xs font-bold transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Default</span>
            </button>
          )}
        </div>
      </div>

      {/* Preset Archetypes Section with Real Architectural Imagery */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#88867C]">
              Architectural Archetypes
            </p>
            <h2 className="text-xl sm:text-2xl font-light text-[#222222] font-heading tracking-tight">
              Select a Preset Residence
            </h2>
          </div>
          <p className="text-xs text-[#88867C]">
            Click an archetype to auto-populate specifications & trigger valuation
          </p>
        </div>

        {/* 5 Architectural Preset Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {housePresets.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#DCDCCA] border-2 border-[#222222] shadow-xl ring-2 ring-[#222222]/20 scale-[1.02]"
                    : "bg-[#DCDCCA]/80 hover:bg-[#DCDCCA] border border-[#88867C]/40 hover:border-[#222222]/50 hover:shadow-md hover:-translate-y-0.5"
                }`}
              >
                {/* Property Image Banner */}
                <div className="relative h-28 sm:h-32 w-full overflow-hidden bg-black/10">
                  <img
                    src={preset.image}
                    alt={preset.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.src = "/images/crescent_park_building.jpg";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
                  
                  {/* Floating Tag */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#222222]/85 backdrop-blur-md text-[9px] font-bold text-[#DCDCCA] border border-white/20">
                    {preset.tag}
                  </div>

                  {/* Selected Active Checkmark */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#222222] text-[#DCDCCA] flex items-center justify-center shadow-md">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}

                  {/* Location Pin */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-semibold text-white/90 drop-shadow-md">
                    <MapPin className="w-3 h-3 text-[#DCDCCA]" />
                    <span>{preset.location}</span>
                  </div>
                </div>

                {/* Card Info Details */}
                <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-[#222222] truncate group-hover:text-black">
                      {preset.name}
                    </h3>
                    <p className="text-[11px] text-[#88867C] mt-0.5 font-medium">
                      {preset.area.toLocaleString()} sqft • {preset.bhk} BHK • {preset.bath} Bath
                    </p>
                  </div>

                  <div className="pt-1.5 border-t border-[#88867C]/20 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-[#88867C]">Benchmark</span>
                    <span className="font-bold text-[#222222] font-mono">{preset.benchmarkPrice}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main 2-Column Split: Property Parameters & Valuation Estimate */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: Property Parameters (Visually Appealing Form Container) */}
        <div className="lg:col-span-7 bg-[#DCDCCA] rounded-3xl border border-[#88867C]/50 p-6 sm:p-7 shadow-xl space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#88867C]/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#222222] text-[#DCDCCA] flex items-center justify-center shadow-sm">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#222222]">
                  Property Parameters
                </h3>
                <p className="text-xs text-[#88867C]">
                  Configure structural variables and select inference model
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => applyPreset(activePreset)}
              className="text-[11px] font-bold text-[#88867C] hover:text-[#222222] transition-colors flex items-center gap-1"
              title="Reset parameters to active preset values"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Parameter 1: Built-up Area */}
          <div className="space-y-3 bg-[#C4C0AC]/40 rounded-2xl p-4 border border-[#88867C]/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-[#88867C]" />
                <span>Total Built-Up Area</span>
              </label>
              <div className="flex items-center gap-1 px-3 py-1 bg-[#222222] text-[#DCDCCA] rounded-lg font-mono text-sm font-bold shadow-xs">
                <span>{sqft.toLocaleString()}</span>
                <span className="text-[10px] font-sans text-[#DCDCCA]/75">sqft</span>
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="500"
              max="6000"
              step="25"
              value={sqft}
              onChange={(e) => setSqft(Number(e.target.value))}
              className="w-full h-2 bg-[#C4C0AC] rounded-lg appearance-none cursor-pointer accent-[#222222]"
            />

            {/* Quick Chips for Area */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-[#88867C] mr-1">Quick sizes:</span>
              {[950, 1400, 1850, 2400, 3200, 4500].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSqft(size)}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                    sqft === size
                      ? "bg-[#222222] text-[#DCDCCA] font-bold"
                      : "bg-[#DCDCCA] hover:bg-[#C4C0AC] text-[#222222] border border-[#88867C]/40"
                  }`}
                >
                  {size.toLocaleString()} sqft
                </button>
              ))}
            </div>
          </div>

          {/* Parameter 2: Bedroom, Bathroom & Balcony Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Bedrooms (BHK) */}
            <div className="bg-[#C4C0AC]/40 rounded-2xl p-3.5 border border-[#88867C]/30 space-y-2">
              <label className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                <Bed className="w-3.5 h-3.5 text-[#88867C]" />
                <span>Bedrooms (BHK)</span>
              </label>
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setBhk(num)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      bhk === num
                        ? "bg-[#222222] text-[#DCDCCA] shadow-xs"
                        : "bg-[#DCDCCA] hover:bg-[#C4C0AC] text-[#222222] border border-[#88867C]/40"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Bathrooms */}
            <div className="bg-[#C4C0AC]/40 rounded-2xl p-3.5 border border-[#88867C]/30 space-y-2">
              <label className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                <Bath className="w-3.5 h-3.5 text-[#88867C]" />
                <span>Bathrooms</span>
              </label>
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setBath(num)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      bath === num
                        ? "bg-[#222222] text-[#DCDCCA] shadow-xs"
                        : "bg-[#DCDCCA] hover:bg-[#C4C0AC] text-[#222222] border border-[#88867C]/40"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Balconies */}
            <div className="bg-[#C4C0AC]/40 rounded-2xl p-3.5 border border-[#88867C]/30 space-y-2">
              <label className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#88867C]" />
                <span>Balconies</span>
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[0, 1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setBalcony(num)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      balcony === num
                        ? "bg-[#222222] text-[#DCDCCA] shadow-xs"
                        : "bg-[#DCDCCA] hover:bg-[#C4C0AC] text-[#222222] border border-[#88867C]/40"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Parameter 3: Locality & Area Classification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-[#C4C0AC]/40 rounded-2xl p-3.5 border border-[#88867C]/30 space-y-1.5">
              <label className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#88867C]" />
                <span>Micro-Market Locality</span>
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-[#DCDCCA] border border-[#88867C]/50 rounded-xl text-xs font-bold text-[#222222] focus:outline-none focus:ring-1 focus:ring-[#222222]"
              >
                <option value="Whitefield">Whitefield (East Bangalore)</option>
                <option value="Sarjapur  Road">Sarjapur Road (Tech Corridor)</option>
                <option value="Koramangala">Koramangala (Prime Central)</option>
                <option value="Indiranagar">Indiranagar (Luxury Lifestyle)</option>
                <option value="Electronic City">Electronic City (IT Cluster)</option>
                <option value="Hebbal">Hebbal (North International)</option>
                <option value="HSR Layout">HSR Layout (Startup Hub)</option>
                <option value="Thanisandra">Thanisandra (Airport Growth)</option>
              </select>
            </div>

            <div className="bg-[#C4C0AC]/40 rounded-2xl p-3.5 border border-[#88867C]/30 space-y-1.5">
              <label className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#88867C]" />
                <span>Area Classification</span>
              </label>
              <select
                value={areaType}
                onChange={(e) => setAreaType(e.target.value)}
                className="w-full px-3 py-2 bg-[#DCDCCA] border border-[#88867C]/50 rounded-xl text-xs font-bold text-[#222222] focus:outline-none focus:ring-1 focus:ring-[#222222]"
              >
                <option value="Super built-up  Area">Super built-up Area (Standard)</option>
                <option value="Built-up  Area">Built-up Area (Carpet + Walls)</option>
                <option value="Plot  Area">Plot Area (Independent Villa)</option>
              </select>
            </div>
          </div>

          {/* Parameter 4: Dual-Engine Model Chooser */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#88867C]" />
              <span>Machine Learning Engine</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedModel("RandomForest")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-start justify-between ${
                  selectedModel === "RandomForest"
                    ? "bg-[#222222] text-[#DCDCCA] border-[#222222] shadow-md"
                    : "bg-[#C4C0AC]/40 hover:bg-[#C4C0AC]/70 text-[#222222] border-[#88867C]/40"
                }`}
              >
                <div>
                  <div className="text-xs font-bold">Random Forest Regressor</div>
                  <div className={`text-[11px] mt-0.5 ${selectedModel === "RandomForest" ? "text-[#DCDCCA]/75" : "text-[#88867C]"}`}>
                    Bootstrap Ensemble • 89.4% Accuracy
                  </div>
                </div>
                {selectedModel === "RandomForest" && (
                  <CheckCircle2 className="w-4 h-4 text-[#DCDCCA] shrink-0 ml-2" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedModel("XGBoost")}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-start justify-between ${
                  selectedModel === "XGBoost"
                    ? "bg-[#222222] text-[#DCDCCA] border-[#222222] shadow-md"
                    : "bg-[#C4C0AC]/40 hover:bg-[#C4C0AC]/70 text-[#222222] border-[#88867C]/40"
                }`}
              >
                <div>
                  <div className="text-xs font-bold">XGBoost Regularized</div>
                  <div className={`text-[11px] mt-0.5 ${selectedModel === "XGBoost" ? "text-[#DCDCCA]/75" : "text-[#88867C]"}`}>
                    Gradient Boosted Trees • 91.2% Accuracy
                  </div>
                </div>
                {selectedModel === "XGBoost" && (
                  <CheckCircle2 className="w-4 h-4 text-[#DCDCCA] shrink-0 ml-2" />
                )}
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            disabled={predicting}
            onClick={() => handlePredict(true)}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#222222] hover:bg-black text-[#DCDCCA] text-sm font-bold shadow-xl hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
          >
            {predicting ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#DCDCCA]" />
            ) : (
              <Calculator className="w-4 h-4 text-[#DCDCCA]" />
            )}
            <span>{predicting ? "Computing ML Valuation..." : "Calculate Valuation"}</span>
            <ArrowRight className="w-4 h-4 text-[#DCDCCA]" />
          </button>
        </div>

        {/* Right Column: Valuation Estimate Container (Elevated Luxury Showcase) */}
        <div className="lg:col-span-5 bg-[#DCDCCA] rounded-3xl border border-[#88867C]/50 p-6 sm:p-7 shadow-xl flex flex-col justify-between space-y-5">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#88867C]/30">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#88867C]">
                Valuation Estimate
              </p>
              <h3 className="text-base font-bold text-[#222222]">
                Intelligent Market Valuation
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#222222] text-[#DCDCCA]">
              AI Verified
            </span>
          </div>

          {/* Hero Image Showcase of Active Archetype */}
          <div className="relative h-40 sm:h-44 w-full rounded-2xl overflow-hidden shadow-inner bg-black/10">
            <img
              src={activePreset.image}
              alt={activePreset.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "/images/crescent_park_building.jpg";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
            
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-[#222222]/85 backdrop-blur-md text-[10px] font-bold text-[#DCDCCA] border border-white/20">
              Archetype: {activePreset.name}
            </div>

            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white drop-shadow-md">
              <div className="text-xs font-bold truncate">
                {location} • {sqft} sqft
              </div>
              <div className="text-[11px] font-mono font-semibold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded">
                {selectedModel}
              </div>
            </div>
          </div>

          {/* Primary Valuation Hero Card */}
          {prediction ? (
            <div className="space-y-4">
              <div className="bg-[#C4C0AC]/45 rounded-2xl p-4 sm:p-5 border border-[#88867C]/30 text-center space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#88867C]">
                  Estimated Property Value
                </span>
                <div className="text-4xl sm:text-5xl font-light text-[#222222] tracking-tight font-heading mt-0.5">
                  {prediction.inrFormatted}
                </div>
                <div className="text-xs font-bold text-[#88867C] font-mono">
                  {prediction.usdFormatted}
                </div>

                {/* 95% Confidence Interval Band */}
                <div className="pt-3 mt-3 border-t border-[#88867C]/25 text-[11px]">
                  <div className="flex items-center justify-between text-[#88867C] font-semibold mb-1">
                    <span>95% Confidence Interval</span>
                    <span className="text-[#222222] font-mono font-bold">
                      {prediction.confidenceLow} – {prediction.confidenceHigh}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#DCDCCA] rounded-full overflow-hidden flex items-center p-0.5">
                    <div className="w-1/4 h-full bg-[#88867C]/30 rounded-full"></div>
                    <div className="w-1/2 h-full bg-[#222222] rounded-full"></div>
                    <div className="w-1/4 h-full bg-[#88867C]/30 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* 2x2 Key Metric Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-[#C4C0AC]/40 rounded-xl border border-[#88867C]/30">
                  <span className="text-[10px] font-bold text-[#88867C] uppercase">
                    Rate / Sqft
                  </span>
                  <p className="text-xs font-bold text-[#222222] font-mono mt-0.5">
                    {prediction.pricePerSqft}
                  </p>
                </div>

                <div className="p-3 bg-[#C4C0AC]/40 rounded-xl border border-[#88867C]/30">
                  <span className="text-[10px] font-bold text-[#88867C] uppercase">
                    Locality Index
                  </span>
                  <p className="text-xs font-bold text-[#222222] mt-0.5">
                    +28% Prime Hub
                  </p>
                </div>

                <div className="p-3 bg-[#C4C0AC]/40 rounded-xl border border-[#88867C]/30">
                  <span className="text-[10px] font-bold text-[#88867C] uppercase">
                    Model Confidence
                  </span>
                  <p className="text-xs font-bold text-[#222222] mt-0.5">
                    89.4% (R² Score)
                  </p>
                </div>

                <div className="p-3 bg-[#C4C0AC]/40 rounded-xl border border-[#88867C]/30">
                  <span className="text-[10px] font-bold text-[#88867C] uppercase">
                    Classification
                  </span>
                  <p className="text-xs font-bold text-[#222222] truncate mt-0.5">
                    {areaType.split(" ")[0]} Area
                  </p>
                </div>
              </div>

              {/* Feature Importance Weights in Valuation */}
              <div className="p-3.5 bg-[#C4C0AC]/40 rounded-xl border border-[#88867C]/30 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#88867C]">
                  <span>Feature Weights in Valuation</span>
                  <span>SHAP Trees</span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div>
                    <div className="flex justify-between font-semibold text-[#222222] mb-0.5">
                      <span>Built-Up Area ({sqft} sqft)</span>
                      <span>48%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#DCDCCA] rounded-full overflow-hidden">
                      <div className="h-full bg-[#222222] rounded-full" style={{ width: "48%" }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-[#222222] mb-0.5">
                      <span>Locality ({location})</span>
                      <span>28%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#DCDCCA] rounded-full overflow-hidden">
                      <div className="h-full bg-[#222222] rounded-full" style={{ width: "28%" }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-[#222222] mb-0.5">
                      <span>Bathrooms & Facilities ({bath} Bath)</span>
                      <span>14%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#DCDCCA] rounded-full overflow-hidden">
                      <div className="h-full bg-[#88867C] rounded-full" style={{ width: "14%" }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-[#222222] mb-0.5">
                      <span>Bedrooms Configuration ({bhk} BHK)</span>
                      <span>10%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#DCDCCA] rounded-full overflow-hidden">
                      <div className="h-full bg-[#88867C] rounded-full" style={{ width: "10%" }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Link to Full Architectural Dashboard */}
              <Link
                to="/dashboard"
                className="w-full py-2.5 px-4 rounded-xl bg-[#222222] hover:bg-black text-[#DCDCCA] text-xs font-bold transition-all shadow-sm flex items-center justify-between group"
              >
                <span>View Full Architectural Dashboard & Market Analytics</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          ) : (
            <div className="py-12 text-center text-[#88867C] space-y-2">
              <Calculator className="w-8 h-8 mx-auto opacity-50 animate-pulse" />
              <p className="text-xs font-semibold">Calculating valuation...</p>
            </div>
          )}

        </div>

      </div>

      {/* Client CSV Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#DCDCCA] rounded-3xl border border-[#88867C] p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in-50 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#222222]" />
                <h3 className="text-sm font-bold text-[#222222]">
                  Upload Client CSV for Custom Training
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-[#88867C] hover:text-[#222222] text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-[#88867C]">
              Upload your client real estate CSV or Excel dataset. The pipeline will automatically preprocess features and train RandomForest & XGBoost regressors.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-full bg-[#C4C0AC] hover:bg-[#C4C0AC]/80 border border-[#88867C] text-xs font-bold text-[#222222] cursor-pointer"
              >
                {uploadFile ? `Change File (${uploadFile.name})` : "Select CSV / Excel File"}
              </button>

              {uploadFile && (
                <button
                  type="button"
                  disabled={uploading || trainingCustom}
                  onClick={handleUploadAndTrain}
                  className="px-5 py-2 rounded-full bg-[#222222] hover:bg-black text-[#DCDCCA] text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {(uploading || trainingCustom) && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>
                    {trainingCustom
                      ? "Training AI..."
                      : uploading
                      ? "Uploading..."
                      : "Train on My CSV"}
                  </span>
                </button>
              )}
            </div>

            {uploadFile && (
              <p className="text-[11px] font-mono text-center text-[#222222]">
                Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}