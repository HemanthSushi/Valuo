import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem("user");

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}