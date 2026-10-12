import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Home, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Simulate network delay for realism
    setTimeout(() => {
      // 1. Get user from LocalStorage
      const storedUser = JSON.parse(localStorage.getItem("user"));

      // 2. Check if user exists AND if password matches
      if (storedUser && storedUser.email === formData.email && storedUser.password === formData.password) {
        toast.success("Welcome back!");
        navigate("/home"); 
      } else {
        // 3. Reject if they don't match
        toast.error("Invalid email or password");
      }
      
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="w-full h-screen flex overflow-hidden bg-background font-sans">
      {/* LEFT SIDE - BLACK BACKGROUND */}
      <div className="hidden lg:flex w-1/2 bg-black flex-col justify-between p-12 lg:p-16 text-white relative z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
            <Home className="w-8 h-8 text-white" />
          </div>
          <span className="text-2xl font-bold font-heading tracking-tight">
            TrueWorth
          </span>
        </div>

        <div className="space-y-8">
          <div className="max-w-lg">
            <h2 className="text-5xl font-extrabold font-heading mb-6 leading-tight tracking-tight text-white">
              Unlock the true value of real estate.
            </h2>
            <p className="text-zinc-400 text-xl leading-relaxed">
              An intelligent system for Bangalore house price prediction
            </p>
          </div>

          <div className="pt-8 border-t border-white/10">
            <p className="text-sm font-medium text-zinc-500">
              © 2025 PricePredict Platform.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT LOGIN FORM */}
      <div className="w-full lg:w-1/2 flex justify-center items-center p-8 lg:p-24 bg-background">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="text-left">
            <h1 className="text-4xl font-bold font-heading tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-3 text-lg">
              Sign in to access your dashboard and insights.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground/70" />
                <input
                  name="email"
                  type="email"
                  required
                  onChange={handleChange}
                  placeholder="name@example.com"
                  className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 pl-11 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
               <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Password</label>
                <Link to="#" className="text-sm font-medium text-primary hover:underline underline-offset-4">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground/70" />
                <input
                  name="password"
                  type="password"
                  required
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 pl-11 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-lg text-base font-semibold shadow-sm"
              disabled={loading}
            >
              {loading ? (
                "Signing in..."
              ) : (
                <span className="flex items-center justify-center">
                  Sign In <ArrowRight className="ml-2 h-5 w-5" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            {/* MAKE SURE THIS POINTS TO YOUR SIGNUP ROUTE */}
            <Link to="/signup" className="font-semibold text-primary hover:underline underline-offset-4">
              Sign up now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}