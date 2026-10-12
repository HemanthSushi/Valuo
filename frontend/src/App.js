import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import HomePage from "./pages/HomePage";
import EDAPage from "./pages/EDAPage";
import TrainPage from "./pages/TrainPage";
import ComparePage from "./pages/ComparePage";
import ExplainabilityPage from "./pages/ExplainabilityPage";
import PredictPage from "./pages/PredictPage";
import ForecastPage from "./pages/ForecastPage";

import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import Layout from "./components/Layout";
import "./App.css";

const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem("user");
  return user ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Redirect root */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Protected */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/home" element={<HomePage />} />
          <Route path="/eda/:datasetId" element={<EDAPage />} />
          <Route path="/train/:datasetId" element={<TrainPage />} />
          <Route path="/compare/:datasetId" element={<ComparePage />} />
          <Route path="/explainability/:datasetId" element={<ExplainabilityPage />} />
          <Route path="/predict/:datasetId" element={<PredictPage />} />
          <Route path="/forecast/:datasetId" element={<ForecastPage />} />
        </Route>
      </Routes>

      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}
