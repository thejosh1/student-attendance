"use client";

import Link from "next/link";
import { useState } from "react";
import { useLecturerAuth } from "@/lib/auth";

interface LecturerGateProps {
  children: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
}

export default function LecturerGate({
  children,
  pageTitle = "Lecturer Portal",
  pageDescription = "Authorized Staff & Faculty Access Only",
}: LecturerGateProps) {
  const { user, isAuthenticated, loading, login, register, logout } = useLecturerAuth();
  const [mode, setMode] = useState<"login" | "register">("login");

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("lecturer@futo.edu.ng");
  const [password, setPassword] = useState("password123");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (mode === "register") {
      const res = await register({
        name,
        email,
        password,
      });
      setSubmitting(false);
      if (!res.success) {
        setError(res.error || "Failed to create account.");
      }
    } else {
      const res = await login(email, password);
      setSubmitting(false);
      if (!res.success) {
        setError(res.error || "Authentication failed.");
      }
    }
  };

  const handleQuickDemo = async () => {
    setEmail("lecturer@futo.edu.ng");
    setPassword("password123");
    setSubmitting(true);
    setError(null);
    const res = await login("lecturer@futo.edu.ng", "password123");
    setSubmitting(false);
    if (!res.success) setError(res.error || "Login error");
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-20 text-center text-slate-500">
        <div className="flex items-center justify-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <span>Verifying lecturer authorization…</span>
        </div>
      </main>
    );
  }

  // If authenticated, render children with top banner showing the active lecturer profile
  if (isAuthenticated && user) {
    return (
      <div>
        <div className="border-b border-slate-200 bg-slate-900 text-white text-xs px-4 py-2">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="font-semibold text-slate-300">Signed In:</span>
              <span className="font-bold text-white tracking-wide">{user.name}</span>
              {user.staffId && (
                <span className="text-slate-400 font-mono hidden md:inline">({user.staffId})</span>
              )}
              {user.department && (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-bold uppercase hidden sm:inline">
                  {user.department}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 hidden sm:inline">{user.email}</span>
              <button
                onClick={logout}
                className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
        {children}
      </div>
    );
  }

  // Otherwise, render modern institutional authentication challenge (Sign In or Register)
  return (
    <main className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        {/* Institutional Header */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg shadow-slate-900/20">
            <svg className="h-8 w-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Restricted Section · Faculty Only
          </div>

          <h1 className="mt-3 text-2xl font-black text-slate-900">{pageTitle}</h1>
          <p className="mt-1 text-xs text-slate-500">{pageDescription}</p>
        </div>

        {/* Tab Switcher: Sign In vs Create Account */}
        <div className="mt-6 flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mode === "login"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
              if (email === "lecturer@futo.edu.ng") setEmail("");
              if (password === "password123") setPassword("");
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mode === "register"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3.5 border border-rose-200 text-xs font-semibold text-rose-700 animate-in fade-in">
            {error}
          </div>
        )}

        {/* Dynamic Form: Login or Register */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Lecturer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Ngozi Adebayo or Engr. Frank Obi"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                This name will automatically prefill as the lecturer for your created class sessions.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Staff Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. lecturer@futo.edu.ng or your institutional email"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            {mode === "register" && (
              <p className="mt-1 text-[11px] text-slate-500">
                Choose a password (minimum 4 characters) to secure your sessions.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-md shadow-slate-900/25 transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {mode === "register" ? "Creating Account…" : "Authenticating…"}
              </>
            ) : mode === "register" ? (
              "Create Lecturer Account"
            ) : (
              "Sign In as Course Lecturer"
            )}
          </button>
        </form>

        {/* Toggle Mode Hint */}
        <div className="mt-4 text-center">
          {mode === "login" ? (
            <p className="text-xs text-slate-500">
              Don&apos;t have an account yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                  if (email === "lecturer@futo.edu.ng") setEmail("");
                  if (password === "password123") setPassword("");
                }}
                className="font-bold text-emerald-700 hover:underline"
              >
                Create Account
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="font-bold text-emerald-700 hover:underline"
              >
                Sign In
              </button>
            </p>
          )}
        </div>

        {/* Quick Demo Fill Button (in Login mode) */}
        {mode === "login" && (
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleQuickDemo}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Quick Demo Sign-In (Engr. Prof. Okafor)
            </button>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <Link
            href="/"
            className="text-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition py-1"
          >
            ← Return to Live Attendance Terminal
          </Link>
        </div>
      </div>
    </main>
  );
}
