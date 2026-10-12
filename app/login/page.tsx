"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLecturerAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, login } = useLecturerAuth();
  const [email, setEmail] = useState("lecturer@futo.edu.ng");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/lecturer");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = login(email, password);
    setLoading(false);
    if (res.success) {
      router.push("/lecturer");
    } else {
      setError(res.error || "Authentication failed. Check email and password.");
    }
  };

  const handleQuickDemo = () => {
    const res = login("lecturer@futo.edu.ng", "password123");
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
          <h1 className="mt-2 text-2xl font-black text-slate-900">Lecturer Sign In</h1>
          <p className="mt-1 text-xs text-slate-500">
            Sign in to access session scheduling, hardware node controls, and system parameters
          </p>
        </div>

        {error && (
          <div className="mt-5 rounded-xl bg-rose-50 p-3.5 border border-rose-200 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Staff Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="lecturer@futo.edu.ng"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
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
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Authenticating…" : "Sign In to Portal"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
          <button
            type="button"
            onClick={handleQuickDemo}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-800 hover:bg-blue-100 transition"
          >
            One-Click Lecturer Demo Sign-In
          </button>

          <div className="text-center">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              ← Back to Student Terminal
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
