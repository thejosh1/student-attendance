"use client";

import { useEffect, useState } from "react";

export interface LecturerUser {
  id: string;
  name: string;
  email: string;
  staffId?: string;
  department?: string;
  title?: string;
  role: "lecturer" | "admin";
}

interface StoredAccount extends LecturerUser {
  password?: string;
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
const REGISTERED_STORAGE_KEY = "futo_registered_lecturers";

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
  // Dispatch custom event for cross-component synchronization
  window.dispatchEvent(new Event("futo_auth_change"));
}

function getLocalRegistered(): StoredAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REGISTERED_STORAGE_KEY);
    if (!raw) {
      // Seed with default lecturer demo account
      const defaultList: StoredAccount[] = [
        {
          ...DEFAULT_LECTURER,
          password: "password123",
        },
      ];
      localStorage.setItem(REGISTERED_STORAGE_KEY, JSON.stringify(defaultList));
      return defaultList;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalRegistered(account: StoredAccount) {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalRegistered();
    const idx = list.findIndex((a) => a.email.toLowerCase() === account.email.toLowerCase());
    if (idx >= 0) {
      list[idx] = account;
    } else {
      list.push(account);
    }
    localStorage.setItem(REGISTERED_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to save local registered account:", e);
  }
}

/**
 * Register a new lecturer account
 */
export async function registerLecturer(data: {
  name: string;
  email: string;
  password: string;
  department?: string;
  staffId?: string;
}): Promise<{ success: boolean; user?: LecturerUser; error?: string }> {
  const cleanName = data.name.trim();
  const cleanEmail = data.email.trim().toLowerCase();
  const cleanPass = data.password.trim();

  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: "Please enter your full lecturer name." };
  }
  if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (!cleanPass || cleanPass.length < 4) {
    return { success: false, error: "Password must be at least 4 characters long." };
  }

  // Check locally if account already exists
  const localList = getLocalRegistered();
  if (localList.some((a) => a.email.toLowerCase() === cleanEmail)) {
    return {
      success: false,
      error: "An account with this email address already exists. Please sign in instead.",
    };
  }

  // Attempt backend server registration
  let createdUser: LecturerUser | null = null;
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register",
        name: cleanName,
        email: cleanEmail,
        password: cleanPass,
        department: data.department || "School of Engineering & Engineering Technology (SEET)",
        staffId: data.staffId,
      }),
    });

    const body = await res.json();
    if (!res.ok) {
      return { success: false, error: body.error || "Failed to create account." };
    }
    createdUser = body.user;
  } catch (err) {
    console.warn("Backend auth API unreachable, registering locally:", err);
  }

  // Fallback to local user object if backend didn't provide one
  if (!createdUser) {
    createdUser = {
      id: `lec-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      staffId: data.staffId || `FUTO/STF/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
      department: data.department || "School of Engineering & Engineering Technology (SEET)",
      title: "Course Lecturer",
      role: "lecturer",
    };
  }

  // Save to client storage & log in immediately
  saveLocalRegistered({
    ...createdUser,
    password: cleanPass,
  });
  setStoredLecturer(createdUser);

  return { success: true, user: createdUser };
}

/**
 * Log in an existing lecturer
 */
export async function loginLecturer(
  email: string,
  password: string
): Promise<{ success: boolean; user?: LecturerUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = password.trim();

  if (!cleanEmail || !cleanPass) {
    return { success: false, error: "Please enter both email and password." };
  }

  // Try server API first
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "login",
        email: cleanEmail,
        password: cleanPass,
      }),
    });

    const body = await res.json();
    if (res.ok && body.user) {
      setStoredLecturer(body.user);
      return { success: true, user: body.user };
    }
  } catch (err) {
    console.warn("Backend login failed or offline, checking local credentials:", err);
  }

  // Local fallback verification
  const localList = getLocalRegistered();
  const matched = localList.find((a) => a.email.toLowerCase() === cleanEmail);

  if (matched && matched.password === cleanPass) {
    const { password: _, ...user } = matched;
    setStoredLecturer(user);
    return { success: true, user };
  }

  // Default demo credentials check
  if (
    (cleanEmail === "lecturer@futo.edu.ng" &&
      (cleanPass === "password123" || cleanPass === "futo2026" || cleanPass === "admin")) ||
    (cleanEmail.endsWith("@futo.edu.ng") && cleanPass === "password123")
  ) {
    const user: LecturerUser = {
      ...DEFAULT_LECTURER,
      email: cleanEmail,
    };
    setStoredLecturer(user);
    return { success: true, user };
  }

  return {
    success: false,
    error: "Invalid lecturer credentials. If you haven't created an account yet, please use Create Account.",
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
    register: registerLecturer,
    logout: logoutLecturer,
  };
}
