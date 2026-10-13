"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLecturerAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, login, register } = useLecturerAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("lecturer@futo.edu.ng");
  const [password, setPassword] = useState("password123");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/lecturer");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (mode === "register") {
      const res = await register({ name, email, password });
      setSubmitting(false);
      if (res.success) {
        router.push("/lecturer");
      } else {
        setError(res.error || "Failed to create account. Please check your details.");
      }
    } else {
      const res = await login(email, password);
      setSubmitting(false);
      if (res.success) {
        router.push("/lecturer");
      } else {
        setError(res.error || "Authentication failed. Check email and password.");
      }
    }
  };

  const handleQuickDemo = async () => {
    setSubmitting(true);
    const res = await login("lecturer@futo.edu.ng", "password123");
    setSubmitting(false);
    if (res.success) {
      router.push("/lecturer");
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-900 text-white shadow-lg shadow-blue-900/20">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <span className="mt-4 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
            FACULTY &amp; STAFF AUTHENTICATION
          </span>
          <h1 className="mt-2 text-2xl font-black text-slate-900">
            {mode === "register" ? "Create Lecturer Account" : "Lecturer Sign In"}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {mode === "register"
              ? "Register with your name, staff email, and password to manage attendance sessions"
              : "Sign in to access session scheduling, hardware node controls, and system parameters"}
          </p>
        </div>

        {/* Tab Switcher */}
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

        {error && (
          <div className="mt-5 rounded-xl bg-rose-50 p-3.5 border border-rose-200 text-xs font-semibold text-rose-700 animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Lecturer Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Ngozi Adebayo or Engr. Frank Obi"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Your name will be prefilled automatically when creating attendance sessions.
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
              placeholder="e.g. lecturer@futo.edu.ng or your email"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
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
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
            {mode === "register" && (
              <p className="mt-1 text-[11px] text-slate-500">
                Password must be at least 4 characters.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {mode === "register" ? "Creating Account…" : "Authenticating…"}
              </>
            ) : mode === "register" ? (
              "Create Account & Proceed"
            ) : (
              "Sign In to Portal"
            )}
          </button>
        </form>

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
                className="font-bold text-blue-700 hover:underline"
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
                className="font-bold text-blue-700 hover:underline"
              >
                Sign In
              </button>
            </p>
          )}
        </div>

        {mode === "login" && (
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
            <button
              type="button"
              onClick={handleQuickDemo}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-800 hover:bg-blue-100 transition"
            >
              Quick Demo Lecturer Sign-In (Engr. Prof. Okafor)
            </button>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            ← Back to Student Terminal
          </Link>
        </div>
      </div>
    </main>
  );
}
