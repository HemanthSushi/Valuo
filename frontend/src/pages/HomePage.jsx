import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  Upload,
  Database,
  TrendingUp,
  Zap,
  User,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import houseImg from "@/assets/house.jpg"; // ✅ LOCAL IMAGE

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function HomePage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false); // ✅ dropdown state

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  // ✅ LOGOUT FUNCTION
  const logout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(
        `Dataset uploaded successfully! ${response.data.rows} rows, ${response.data.columns} columns`
      );
      navigate(`/eda/${response.data.dataset_id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const features = [
    {
      icon: Database,
      title: "Automated EDA",
      description: "Comprehensive exploratory data analysis with visualizations",
    },
    {
      icon: TrendingUp,
      title: "Multi-Model Training",
      description:
        "Train and compare LinearRegression, RandomForest, XGBoost, LightGBM",
    },
    {
      icon: Zap,
      title: "SHAP Explainability",
      description:
        "Understand model predictions with SHAP values and feature importance",
    },
  ];

  return (
    <>
      {/* 🔹 USER PROFILE (TOP RIGHT) */}
      <div className="flex justify-end mb-4">
        <div className="relative z-50">
          <User
            className="w-6 h-6 cursor-pointer"
            onClick={() => setOpen(!open)}
          />

          {open && (
            <div className="absolute right-0 mt-2 w-48 bg-white border shadow-lg rounded-md">
              <div className="p-2 text-sm border-b truncate">
                {user?.email}
              </div>

              <button
                onClick={logout}
                className="flex items-center gap-2 p-2 w-full text-sm hover:bg-gray-100"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 🔹 MAIN CONTENT */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-7 space-y-8">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
              House Price
              <br />
              <span className="text-primary">Prediction Platform</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Upload your dataset, run automated EDA, train ML models, and get
              predictions with explainability.
            </p>
          </div>

          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-4">Upload Dataset</h2>

            <div
              className="border-2 border-dashed p-12 text-center cursor-pointer"
              onClick={() => document.getElementById("file-input").click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4" />
              <p>{file ? file.name : "Click to upload or drag and drop"}</p>

              <input
                id="file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full mt-6"
            >
              {uploading ? "Uploading..." : "Upload Dataset"}
            </Button>
          </Card>
        </div>

        {/* 🔹 RIGHT SIDE */}
        <div className="md:col-span-5 space-y-6">
          <img
            src={houseImg}
            alt="House"
            className="w-full object-contain rounded-md"
          />

          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="p-6">
                <div className="flex items-start gap-4">
                  <Icon className="w-5 h-5" />
                  <div>
                    <h3 className="font-bold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}