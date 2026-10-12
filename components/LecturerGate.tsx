"use client";

import Link from "next/link";
import { useState } from "react";
import { useLecturerAuth } from "@/lib/auth";

interface LecturerGateProps {
  children: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
}

export default function LecturerGate({ children, pageTitle = "Lecturer Portal", pageDescription = "Authorized Staff & Faculty Access Only" }: LecturerGateProps) {
  const { user, isAuthenticated, loading, login, logout } = useLecturerAuth();
  const [email, setEmail] = useState("lecturer@futo.edu.ng");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setError(null);

    const res = login(email, password);
    setLoggingIn(false);
    if (!res.success) {
      setError(res.error || "Authentication failed.");
    }
  };

  const handleQuickDemo = () => {
    setEmail("lecturer@futo.edu.ng");
    setPassword("password123");
    const res = login("lecturer@futo.edu.ng", "password123");
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

  // If authenticated, render children with a sleek top banner showing the active lecturer profile
  if (isAuthenticated && user) {
    return (
      <div>
        <div className="border-b border-slate-200 bg-slate-900 text-white text-xs px-4 py-2">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="font-semibold text-slate-200">Authenticated Lecturer:</span>
              <span className="font-bold text-white">{user.name}</span>
              <span className="text-slate-400 font-mono hidden md:inline">({user.staffId})</span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-bold uppercase">
                {user.department}
              </span>
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

  // Otherwise, render modern institutional authentication challenge
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

        {/* Notice */}
        <div className="mt-6 rounded-xl bg-slate-50 p-4 border border-slate-200/80 text-xs text-slate-600">
          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
            <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Access Policy
          </p>
          <p className="mt-1 text-slate-500">
            Student enrollment and live terminal attendance check-ins are publicly open. Session scheduling, terminal hardware toggles, and firmware downloads require lecturer sign-in.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3.5 border border-rose-200 text-xs font-semibold text-rose-700 animate-in fade-in">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Lecturer Staff Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="lecturer@futo.edu.ng"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-md shadow-slate-900/25 transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60"
          >
            {loggingIn ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Authenticating…
              </>
            ) : (
              "Sign In as Course Lecturer"
            )}
          </button>
        </form>

        {/* Quick Demo Fill Button */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleQuickDemo}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            One-Click Lecturer Demo Sign-In (Prof. Okafor)
          </button>

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
