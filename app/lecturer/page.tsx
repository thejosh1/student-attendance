"use client";

import { useCallback, useEffect, useState } from "react";
import { BiometricDevice, ClassSession, classes } from "@/lib/data";
import LecturerGate from "@/components/LecturerGate";

export default function LecturerPage() {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [courseCode, setCourseCode] = useState("TCE 511");
  const [topic, setTopic] = useState("");
  const [lecturerName, setLecturerName] = useState("Engr. Prof. K. C. Okafor");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [startTime, setStartTime] = useState("08:00");
  const [lateCutoff, setLateCutoff] = useState("08:15");
  const [endTime, setEndTime] = useState("10:00");
  const [assignedDeviceId, setAssignedDeviceId] = useState("DEV-FUTO-01");

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [creating, setCreating] = useState(false);

  // Default course to device mapping
  const courseDeviceMap: Record<string, string> = {
    "TCE 511": "DEV-FUTO-01",
    "TCE 504": "DEV-FUTO-02",
    "TCE 512": "DEV-FUTO-03",
    "TCE 514": "DEV-FUTO-04",
  };

  const loadData = useCallback(async () => {
    try {
      const [sessRes, devRes] = await Promise.all([
        fetch("/api/sessions", { cache: "no-store" }),
        fetch("/api/devices", { cache: "no-store" }),
      ]);
      const sessData = await sessRes.json();
      const devData = await devRes.json();
      if (sessData.sessions) setSessions(sessData.sessions);
      if (devData.devices) setDevices(devData.devices);
    } catch (e) {
      console.error("Failed to load lecturer data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When course changes, automatically suggest assigned device
  const handleCourseChange = (selectedCourse: string) => {
    setCourseCode(selectedCourse);
    const mappedDev = courseDeviceMap[selectedCourse] || "DEV-FUTO-01";
    setAssignedDeviceId(mappedDev);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setToast({ message: "Please specify the lecture topic/module title.", type: "error" });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode,
          topic: topic.trim(),
          lecturerName: lecturerName.trim(),
          date,
          startTime,
          lateCutoff,
          endTime,
          deviceId: assignedDeviceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");

      setToast({
        message: `Session launched for ${courseCode}! Terminal ${assignedDeviceId} assigned.`,
        type: "success",
      });
      setTimeout(() => setToast(null), 4000);

      setTopic("");
      await loadData();
    } catch (err: any) {
      console.error("Create session error:", err);
      setToast({ message: err.message || "Failed to create session", type: "error" });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleSession = async (sessionId: string) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle");

      setToast({
        message: data.session.isActive
          ? `Session activated for ${data.session.courseCode}! Terminal ${data.session.deviceId} is now dedicated exclusively to this class.`
          : `Session concluded for ${data.session.courseCode}. Terminal ${data.session.deviceId} is now idle.`,
        type: data.session.isActive ? "success" : "info",
      });
      setTimeout(() => setToast(null), 3500);
      await loadData();
    } catch (err: any) {
      console.error("Toggle error:", err);
    }
  };

  const selectedDevice = devices.find((d) => d.id === assignedDeviceId);

  return (
    <LecturerGate
      pageTitle="Class Attendance Session Manager"
      pageDescription="Configure course tracking, activate physical terminal nodes, and manage attendance sessions"
    >
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Banner */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 text-white shadow-md shadow-blue-700/20">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 tracking-wide">
                  LECTURER PORTAL
                </span>
                <span className="text-xs text-slate-500">Course Attendance Scheduling</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                Class Attendance Session Manager
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Set attendance requirements, schedule lecture sessions, and assign dedicated hardware fingerprint units per class.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid: Form on Left, Active Sessions on Right */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Form: Set Attendance for Class */}
        <section className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm">
                +
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Set Attendance For Class</h2>
                <p className="text-xs text-slate-500">Configure parameters & activate fingerprint scanner</p>
              </div>
            </div>

            <form onSubmit={handleCreateSession} className="mt-5 space-y-4">
              {/* Course Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Course <span className="text-rose-500">*</span>
                </label>
                <select
                  value={courseCode}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lecture Topic */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Lecture Topic / Module Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Microprocessor Bus Interfacing & Timers"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Lecturer Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Lecturer Name
                </label>
                <input
                  type="text"
                  value={lecturerName}
                  onChange={(e) => setLecturerName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Date & Start Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Session Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 shadow-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 shadow-sm outline-none"
                  />
                </div>
              </div>

              {/* Late Cutoff & End Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Late Cutoff (Threshold)
                  </label>
                  <input
                    type="time"
                    value={lateCutoff}
                    onChange={(e) => setLateCutoff(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-amber-300 bg-amber-50/40 px-3 py-2 text-xs font-mono text-amber-900 shadow-sm outline-none"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">Scans after this are marked Late</p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 shadow-sm outline-none"
                  />
                </div>
              </div>

              {/* Assigned Hardware Device */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Assigned Fingerprint Hardware Node
                </label>
                <select
                  value={assignedDeviceId}
                  onChange={(e) => setAssignedDeviceId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 shadow-sm outline-none"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} - {d.name} ({d.isEnabled ? "ACTIVE" : "DISABLED"})
                    </option>
                  ))}
                </select>

                {/* Device Warning if Disabled */}
                {selectedDevice && (
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Node Status:</span>
                    {selectedDevice.isEnabled ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Enabled & Online (Accepts Scans)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        DISABLED by Lecturer (Scans Rejected)
                      </span>
                    )}
                  </div>
                )}

                {/* Single Class per Terminal Notice */}
                {(() => {
                  const currentActive = sessions.find((s) => s.deviceId === assignedDeviceId && s.isActive);
                  if (currentActive) {
                    return (
                      <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                        <span className="font-bold flex-shrink-0">⚠️ Notice:</span>
                        <span>
                          <strong>{assignedDeviceId}</strong> is currently taking attendance for <strong>{currentActive.courseCode}</strong>. Activating this session will conclude {currentActive.courseCode} (strictly 1 class per terminal).
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-2.5 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-500">
                      🔒 Terminal Policy: Each physical fingerprint scanner is dedicated to exactly 1 active class at a time.
                    </div>
                  );
                })()}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={creating}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
              >
                {creating ? "Launching Session..." : "Activate Attendance Session"}
              </button>
            </form>
          </div>
        </section>

        {/* List of Class Sessions */}
        <section className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Class Attendance Sessions</h2>
                <p className="text-xs text-slate-500">Live & scheduled course tracking records</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {sessions.length} Configured
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {loading && (
                <div className="py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    Loading class sessions…
                  </div>
                </div>
              )}

              {!loading && sessions.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  No sessions created yet. Use the form to set attendance.
                </div>
              )}

              {sessions.map((sess) => {
                const dev = devices.find((d) => d.id === sess.deviceId);
                return (
                  <div
                    key={sess.id}
                    className={`rounded-xl border p-5 transition ${
                      sess.isActive
                        ? "border-emerald-300 bg-emerald-50/30 ring-1 ring-emerald-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-mono font-bold text-white">
                          {sess.courseCode}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{sess.topic}</h3>
                          <p className="text-xs text-slate-500">{sess.lecturerName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            sess.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              sess.isActive ? "bg-emerald-500 animate-ping" : "bg-slate-400"
                            }`}
                          />
                          {sess.isActive ? "LIVE / ACTIVE" : "Concluded"}
                        </span>

                        <button
                          onClick={() => handleToggleSession(sess.id)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          {sess.isActive ? "End Session" : "Activate"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block">Date</span>
                        <span className="font-mono font-semibold text-slate-700">{sess.date}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Time Window</span>
                        <span className="font-mono font-semibold text-slate-700">
                          {sess.startTime} – {sess.endTime}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Late Cutoff</span>
                        <span className="font-mono font-semibold text-amber-700">
                          After {sess.lateCutoff} AM
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Hardware Node</span>
                        <span className="font-mono font-semibold text-slate-800 flex items-center gap-1">
                          {sess.deviceId}
                          {dev && (
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                dev.isEnabled ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-5 py-3.5 text-sm text-white shadow-2xl ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-5">
          <p className="font-semibold text-slate-100">{toast.message}</p>
        </div>
      )}
      </main>
    </LecturerGate>
  );
}
