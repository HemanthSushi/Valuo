import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";

import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import HomePage from "@/pages/HomePage";
import DashboardPage from "@/pages/DashboardPage";
import PredictPage from "@/pages/PredictPage";
import EDAPage from "@/pages/EDAPage";
import TrainPage from "@/pages/TrainPage";
import ComparePage from "@/pages/ComparePage";
import ExplainabilityPage from "@/pages/ExplainabilityPage";
import ForecastPage from "@/pages/ForecastPage";

import "./App.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes (Untouched) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Root Redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Protected Application Workspace: Responsive Canvas via Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Core Application Pages */}
            <Route path="/home" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/predict" element={<PredictPage />} />
            <Route path="/predict/:datasetId" element={<PredictPage />} />

            {/* ML Studio & Feature Intelligence Workspaces */}
            <Route path="/eda/:datasetId?" element={<EDAPage />} />
            <Route path="/train/:datasetId?" element={<TrainPage />} />
            <Route path="/compare/:datasetId?" element={<ComparePage />} />
            <Route path="/explainability/:datasetId?" element={<ExplainabilityPage />} />
            <Route path="/forecast/:datasetId?" element={<ForecastPage />} />
            <Route path="/data" element={<Navigate to="/home" replace />} />
          </Route>

          {/* Fallback to Home */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          richColors
          visibleToasts={1}
          duration={2200}
          toastOptions={{
            style: {
              borderRadius: "9999px",
              fontFamily: "var(--font-sans, inherit)",
              fontSize: "12px",
              backgroundColor: "#222222",
              color: "#DCDCCA",
              border: "1px solid #88867C",
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
