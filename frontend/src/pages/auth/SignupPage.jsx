import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Home, Mail, Lock, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = (e) => {
    e.preventDefault();
    setLoading(true);

    // ✅ ACTUAL LOGIC: Save email AND password to localStorage
    setTimeout(() => {
      localStorage.setItem("user", JSON.stringify(formData));
      toast.success("Account created! Please sign in.");
      navigate("/"); // Redirects to Login Page
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="w-full h-screen flex overflow-hidden bg-background font-sans">
      {/* LEFT SIDE - MATCHING LOGIN THEME */}
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
              Join the future of real estate analytics.
            </h2>
            <p className="text-zinc-400 text-xl leading-relaxed">
              Create an account to start training models and predicting prices with enterprise-grade accuracy.
            </p>
          </div>
          <div className="pt-8 border-t border-white/10">
            <p className="text-sm font-medium text-zinc-500">
              © 2025 PricePredict Platform.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT SIGNUP FORM */}
      <div className="w-full lg:w-1/2 flex justify-center items-center p-8 lg:p-24 bg-background">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="text-left">
            <h1 className="text-4xl font-bold font-heading tracking-tight">Create an account</h1>
            <p className="text-muted-foreground mt-3 text-lg">
              Enter your details below to get started.
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-6">
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
                  className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 pl-11 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground/70" />
                <input
                  name="password"
                  type="password"
                  required
                  onChange={handleChange}
                  placeholder="Create a password"
                  className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 pl-11 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 rounded-lg text-base font-semibold" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/" className="font-semibold text-primary hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}