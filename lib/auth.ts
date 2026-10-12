"use client";

import { useEffect, useState } from "react";

export interface LecturerUser {
  id: string;
  name: string;
  email: string;
  staffId: string;
  department: string;
  title: string;
  role: "lecturer" | "admin";
}

export const DEFAULT_LECTURER: LecturerUser = {
  id: "lec-futo-01",
  name: "Engr. Prof. K. C. Okafor",
  email: "lecturer@futo.edu.ng",
  staffId: "FUTO/STF/2014/098",
  department: "Telecommunication Engineering (SEET)",
  title: "Professor & Course Coordinator",
  role: "lecturer",
};

const AUTH_STORAGE_KEY = "futo_lecturer_session";

export function getStoredLecturer(): LecturerUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredLecturer(user: LecturerUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    document.cookie = "futo_lecturer_token=; path=/; max-age=0";
  } else {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    document.cookie = `futo_lecturer_token=${user.id}; path=/; max-age=86400; SameSite=Lax`;
  }
  // Dispatch custom event for cross-component sync
  window.dispatchEvent(new Event("futo_auth_change"));
}

export function loginLecturer(email: string, password: string): { success: boolean; user?: LecturerUser; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = password.trim();

  // Accept demo password or any @futo.edu.ng lecturer login
  if (
    (cleanEmail === "lecturer@futo.edu.ng" && (cleanPass === "password123" || cleanPass === "futo2026" || cleanPass === "admin")) ||
    (cleanEmail.endsWith("@futo.edu.ng") && cleanPass.length >= 4) ||
    cleanPass === "password123"
  ) {
    const user: LecturerUser = {
      ...DEFAULT_LECTURER,
      email: cleanEmail || DEFAULT_LECTURER.email,
    };
    setStoredLecturer(user);
    return { success: true, user };
  }

  return {
    success: false,
    error: "Invalid lecturer credentials. Use lecturer@futo.edu.ng with password 'password123'.",
  };
}

export function logoutLecturer() {
  setStoredLecturer(null);
}

/**
 * React hook to observe lecturer authentication state across components
 */
export function useLecturerAuth() {
  const [user, setUser] = useState<LecturerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getStoredLecturer());
    setLoading(false);

    const onAuthChange = () => {
      setUser(getStoredLecturer());
    };

    window.addEventListener("futo_auth_change", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    return () => {
      window.removeEventListener("futo_auth_change", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);

  return {
    user,
    isAuthenticated: Boolean(user),
    loading,
    login: loginLecturer,
    logout: logoutLecturer,
  };
}
