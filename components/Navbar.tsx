"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BiometricDevice } from "@/lib/data";

export default function Navbar() {
  const pathname = usePathname();
  const [devices, setDevices] = useState<BiometricDevice[]>([]);

  useEffect(() => {
    async function fetchDevices() {
      try {
        const res = await fetch("/api/devices", { cache: "no-store" });
        const data = await res.json();
        if (data.devices) setDevices(data.devices);
      } catch (e) {
        console.error("Failed to fetch device status for navbar:", e);
      }
    }
    fetchDevices();
    const id = setInterval(fetchDevices, 6000);
    return () => clearInterval(id);
  }, []);

  const activeCount = devices.filter((d) => d.isEnabled).length;
  const disabledCount = devices.length - activeCount;

  const navLinks = [
    { href: "/", label: "Live Dashboard", icon: "dashboard" },
    { href: "/enroll", label: "Student Enrollment", icon: "user-plus" },
    { href: "/lecturer", label: "Lecturer Sessions", icon: "calendar" },
    { href: "/devices", label: "Biometric Devices", icon: "cpu", badge: `${activeCount} On / ${disabledCount} Off` },
    { href: "/firmware", label: "ESP32 Hardware", icon: "code" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      {/* Top University Ribbon */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 px-4 py-1.5 text-xs text-emerald-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-wider text-emerald-400">W.O.R.C</span>
            <span className="hidden sm:inline text-emerald-300">·</span>
            <span className="hidden sm:inline text-emerald-200">
              Wireless Operations for Real-time Check-in
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Cloud Sync Active
            </span>
            <span className="text-emerald-400">|</span>
            <span className="text-[11px] text-emerald-200">
              Unit: <strong className="text-white">DEV-FUTO-01</strong> ({activeCount} Active / {disabledCount} Disabled)
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-md shadow-emerald-700/20 transition group-hover:scale-105">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 11c0 3.5-1.5 6.5-4 8.5" />
                <path d="M12 3a9 9 0 0 0-9 9c0 3.5 1.5 6.5 4 8.5" />
                <path d="M12 7c-2.76 0-5 2.24-5 5 0 2.5 1.2 4.5 3 6" />
                <path d="M16 12a4 4 0 0 0-4-4" />
                <path d="M19 12c0-3.87-3.13-7-7-7" />
                <path d="M21 12a9 9 0 0 0-9-9" />
                <path d="M12 15a3 3 0 0 0 3-3" />
                <path d="M12 19c2.5 0 4.5-1.5 5.5-3.5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-slate-900 group-hover:text-emerald-700 transition">
                  W.O.R.C
                </span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
                  ESP32 IoT
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 hidden sm:block">
                Wireless Operations for Real-time Check-in
              </p>
            </div>
          </Link>

          {/* Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition ${
                    isActive
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="hidden md:inline-flex rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
