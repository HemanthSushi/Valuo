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

          {/* Protected Application Workspace: Exactly 3 Core Pages */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* 1. Home Page */}
            <Route path="/home" element={<HomePage />} />

            {/* 2. Dashboard Page */}
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* 3. Prediction Page */}
            <Route path="/predict" element={<PredictPage />} />
            <Route path="/predict/:datasetId" element={<PredictPage />} />

            {/* Legacy redirect fallbacks to 3 core pages */}
            <Route path="/data" element={<Navigate to="/home" replace />} />
            <Route path="/eda/:datasetId?" element={<Navigate to="/dashboard" replace />} />
            <Route path="/train/:datasetId?" element={<Navigate to="/predict" replace />} />
            <Route path="/compare/:datasetId?" element={<Navigate to="/dashboard" replace />} />
            <Route path="/explainability/:datasetId?" element={<Navigate to="/predict" replace />} />
            <Route path="/forecast/:datasetId?" element={<Navigate to="/dashboard" replace />} />
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
