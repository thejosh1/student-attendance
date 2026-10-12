"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BiometricDevice, ClassSession, LATE_AFTER, classes, type AttendanceRow, type Status } from "@/lib/data";

const STATUS_STYLES: Record<Status, { badge: string; dot: string; label: string }> = {
  present: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/30 border-emerald-200",
    dot: "bg-emerald-500",
    label: "Present",
  },
  late: {
    badge: "bg-amber-50 text-amber-700 ring-amber-600/30 border-amber-200",
    dot: "bg-amber-500",
    label: "Late Arrival",
  },
  absent: {
    badge: "bg-rose-50 text-rose-700 ring-rose-600/30 border-rose-200",
    dot: "bg-rose-500",
    label: "Absent",
  },
};

const FILTERS: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "All Students" },
  { key: "present", label: "Present" },
  { key: "late", label: "Late" },
  { key: "absent", label: "Absent" },
];

export default function AttendanceDashboard() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [date, setDate] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [className, setClassName] = useState("all");
  const [selectedDeviceId, setSelectedDeviceId] = useState("DEV-FUTO-01");
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      const [attRes, devRes, sessRes] = await Promise.all([
        fetch("/api/attendance", { cache: "no-store" }),
        fetch("/api/devices", { cache: "no-store" }),
        fetch("/api/sessions", { cache: "no-store" }),
      ]);
      const attData = await attRes.json();
      const devData = await devRes.json();
      const sessData = await sessRes.json();

      if (attData.rows) {
        setRows(attData.rows);
        setDate(attData.date);
      }
      if (devData.devices) setDevices(devData.devices);
      if (sessData.sessions) setSessions(sessData.sessions);
    } catch (e) {
      console.error("Failed to fetch attendance:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const activeDevice = devices.find((d) => d.id === selectedDeviceId);
  const activeSession = sessions.find((s) => s.isActive && (className === "all" || s.courseCode === className));

  const stats = useMemo(() => {
    const list = className === "all" ? rows : rows.filter((r) => r.className === className);
    const total = list.length;
    const present = list.filter((r) => r.status === "present").length;
    const late = list.filter((r) => r.status === "late").length;
    const absent = list.filter((r) => r.status === "absent").length;
    const rate = total ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, late, absent, rate };
  }, [rows, className]);

  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filter === "all" || r.status === filter) &&
          (className === "all" || r.className === className) &&
          `${r.name} ${r.admissionNo} ${r.className} ${r.email || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [rows, filter, className, query],
  );

  async function simulateScan() {
    if (isScanning) return;
    setIsScanning(true);

    const pool = (className === "all" ? rows : rows.filter((r) => r.className === className)).filter(
      (r) => r.status === "absent"
    );
    const list = pool.length ? pool : rows;
    const target = list[Math.floor(Math.random() * list.length)];

    if (!target) {
      setIsScanning(false);
      return;
    }

    try {
      const res = await fetch("/api/biometric/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceUserId: target.deviceUserId,
          deviceId: selectedDeviceId,
          classId: target.className,
          method: "fingerprint",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setToast({
          message: data.error || `Scan blocked on ${selectedDeviceId}`,
          type: "error",
        });
      } else {
        setToast({
          message: `Fingerprint Verified: ${data.student} (${target.admissionNo}) — ${data.action.toUpperCase()} on [${selectedDeviceId}] at ${data.time}`,
          type: data.action === "duplicate" ? "info" : "success",
        });
        await load();
      }
      setTimeout(() => setToast(null), 5000);
    } catch (e: any) {
      console.error("Scan error:", e);
      setToast({ message: "Network error during scan", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Institutional Header */}
      <header className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-md shadow-emerald-700/20">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 tracking-wide">
                  W.O.R.C PLATFORM
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Biometric Attendance & Hardware IoT Hub
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                W.O.R.C — Wireless Operations for Real-time Check-in
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Session Date: <span className="font-semibold text-slate-700">{date || "Today"}</span> · Late Cutoff: <span className="font-semibold text-slate-700">{LATE_AFTER} AM</span> · Active Session: <span className="font-semibold text-emerald-700">{activeSession ? activeSession.topic : "General Lecture"}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions & Scanner Node Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Terminal Selector */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5 text-xs">
              <span className="font-semibold text-slate-500 pl-1">Node:</span>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} ({d.isEnabled ? "ENABLED" : "DISABLED"})
                  </option>
                ))}
              </select>
              {activeDevice && (
                <span
                  className={`h-2 w-2 rounded-full ${
                    activeDevice.isEnabled ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                  }`}
                />
              )}
            </div>

            {/* Simulate Scan Button */}
            <button
              onClick={simulateScan}
              disabled={isScanning}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60 ${
                activeDevice?.isEnabled ? "bg-slate-900 hover:bg-slate-800" : "bg-rose-700 hover:bg-rose-800"
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 11c0 3.5-1.5 6.5-4 8.5" />
                <path d="M12 3a9 9 0 0 0-9 9c0 3.5 1.5 6.5 4 8.5" />
                <path d="M12 7c-2.76 0-5 2.24-5 5 0 2.5 1.2 4.5 3 6" />
              </svg>
              {isScanning ? "Processing Scan…" : `Simulate Scan on ${selectedDeviceId}`}
            </button>

            {/* Quick Link to Enroll */}
            <Link
              href="/enroll"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              + Enroll Student
            </Link>
          </div>
        </div>
      </header>

      {/* Disabled Device Warning Banner if user selects a disabled unit */}
      {activeDevice && !activeDevice.isEnabled && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-200 text-rose-700 font-bold">
              !
            </span>
            <span>
              <strong>Device [{activeDevice.id} - {activeDevice.name}] is currently DISABLED.</strong> Any scans sent to or simulated on this device will be blocked by the security policy. Enable it in the{" "}
              <Link href="/devices" className="underline font-bold text-rose-800 hover:text-rose-950">
                Biometric Devices Hub
              </Link>.
            </span>
          </div>
          <Link
            href="/devices"
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
          >
            Manage Devices
          </Link>
        </div>
      )}

      {/* Metrics Row */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Enrolled Students", value: stats.total, color: "text-slate-900", bg: "bg-slate-50", border: "border-slate-200" },
          { label: "Present (Verified)", value: stats.present, color: "text-emerald-700", bg: "bg-emerald-50/50", border: "border-emerald-200" },
          { label: "Late Arrivals", value: stats.late, color: "text-amber-700", bg: "bg-amber-50/50", border: "border-amber-200" },
          { label: "Absent", value: stats.absent, color: "text-rose-700", bg: "bg-rose-50/50", border: "border-rose-200" },
          { label: "Attendance Rate", value: `${stats.rate}%`, color: "text-blue-700", bg: "bg-blue-50/50", border: "border-blue-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-4 transition hover:shadow-sm`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className={`mt-1 text-3xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </section>

      {/* Filters & Search Toolbar */}
      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative w-full sm:w-80">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student name, reg no, email…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Course select */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Course:</label>
            <select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">All Courses ({classes.join(", ")})</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Tab Filters */}
        <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                filter === f.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Attendance Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Student Details</th>
                <th className="px-5 py-3.5">Course Code</th>
                <th className="px-5 py-3.5">Biometric Check-In</th>
                <th className="px-5 py-3.5">Biometric Check-Out</th>
                <th className="px-5 py-3.5">Method & Sensor Node</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                      Loading records…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    No student attendance records matching criteria.
                  </td>
                </tr>
              )}
              {visible.map((r) => {
                const style = STATUS_STYLES[r.status];
                return (
                  <tr key={r.id} className="transition hover:bg-slate-50/75">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-xs font-bold text-white shadow-sm">
                          {r.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{r.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs text-slate-500">{r.admissionNo}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                              Slot: #{r.deviceUserId}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200 font-mono">
                        {r.className}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-800">
                      {r.checkIn ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {r.checkIn}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-800">
                      {r.checkOut ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          {r.checkOut}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.checkIn ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200/60">
                          <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 11c0 3.5-1.5 6.5-4 8.5" />
                            <path d="M12 3a9 9 0 0 0-9 9c0 3.5 1.5 6.5 4 8.5" />
                          </svg>
                          AS608 Optical
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${style.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {style.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Biometric Scan Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm text-white shadow-2xl ring-1 animate-in fade-in slide-in-from-bottom-5 ${
            toast.type === "error"
              ? "bg-rose-950 ring-rose-500/30"
              : toast.type === "info"
              ? "bg-slate-900 ring-white/10"
              : "bg-slate-900 ring-white/10"
          }`}
        >
          <div
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
              toast.type === "error"
                ? "bg-rose-500/20 text-rose-400"
                : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            {toast.type === "error" ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <p className="font-semibold text-slate-100">{toast.message}</p>
          </div>
        </div>
      )}
    </main>
  );
}
