"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClassSession, BiometricDevice } from "@/lib/data";

export default function StudentCheckinPage() {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; admissionNo: string; className: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [admissionNo, setAdmissionNo] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    student?: string;
    admissionNo?: string;
    course?: string;
    sessionTopic?: string;
    time?: string;
    attendanceStatus?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const [sessRes, devRes, attRes] = await Promise.all([
          fetch("/api/sessions", { cache: "no-store" }),
          fetch("/api/devices", { cache: "no-store" }),
          fetch("/api/attendance", { cache: "no-store" }),
        ]);
        const sData = await sessRes.json();
        const dData = await devRes.json();
        const aData = await attRes.json();

        if (sData.sessions) setSessions(sData.sessions);
        if (dData.devices) setDevices(dData.devices);
        if (aData.rows) setStudents(aData.rows);
      } catch (err) {
        console.error("Failed to load session details:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
    const interval = setInterval(init, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeSession = sessions.find((s) => s.isActive);
  const activeDevice = devices.find((d) => d.id === activeSession?.deviceId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!admissionNo.trim() || !otp.trim()) {
      setResult({
        success: false,
        message: "Please enter your Matriculation/Reg No and the 6-digit classroom WiFi OTP.",
      });
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/attendance/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admissionNo: admissionNo.trim(),
          otp: otp.trim(),
          deviceId: activeSession?.deviceId || "DEV-FUTO-01",
          courseCode: activeSession?.courseCode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          message: data.message || "Attendance recorded successfully!",
          student: data.student,
          admissionNo: data.admissionNo,
          course: data.course,
          sessionTopic: data.sessionTopic,
          time: data.time,
          attendanceStatus: data.attendanceStatus,
        });
        setOtp("");
      } else {
        setResult({
          success: false,
          message: data.error || "Attendance verification failed.",
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: "Network communication error. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Live Dashboard
          </Link>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
            W.O.R.C Proximity Check-in
          </span>
        </div>

        {/* Header Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-blue-800 text-white shadow-md shadow-sky-600/20">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                Wireless Operations for Real-time Check-in
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                WiFi OTP Attendance Portal
              </h1>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-600 leading-relaxed">
            Verify your physical classroom presence using the 60-second rotating OTP broadcasted over WiFi by the hardware terminal within <strong>50 feet (15 meters)</strong>.
          </p>

          {/* Active Session Status Box */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            {loading ? (
              <p className="text-xs text-slate-500 animate-pulse">Checking active lecture sessions…</p>
            ) : activeSession ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      LIVE: {activeSession.courseCode}
                    </span>
                  </div>
                  <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                    Terminal: {activeSession.deviceId}
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-medium">{activeSession.topic}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span>Lecturer: {activeSession.lecturerName}</span>
                  <span>Cutoff: {activeSession.lateCutoff}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 mb-1" />
                <p className="text-xs font-semibold text-slate-700">No Lecture Session Active Right Now</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Check-in will activate automatically when the lecturer starts the session.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* How to Find the OTP Guide */}
        <div className="mt-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-blue-50/40 p-4 text-xs text-sky-950">
          <h2 className="font-bold flex items-center gap-1.5 text-sky-900 text-xs">
            <svg className="h-4 w-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to get the 6-digit Classroom OTP (&lt; 50 feet):
          </h2>
          <ul className="mt-2 space-y-1.5 pl-4 list-disc text-[11px] text-sky-800 leading-relaxed">
            <li>
              <strong>Scan WiFi Networks on your phone:</strong> Look for the open network named <code className="bg-sky-100 font-bold px-1 rounded">WORC-OTP-XXXXXX</code>. The last 6 digits are your OTP! (No connection required).
            </li>
            <li>
              <strong>Classroom Terminal Screen:</strong> The 16x2 LCD display on the lecturer&apos;s desk also shows the active OTP in real-time.
            </li>
            <li>
              <strong>Proximity Protection:</strong> The terminal RF power is restricted to <strong>~50 feet</strong>. Devices outside the lecture hall cannot detect the beacon.
            </li>
          </ul>
        </div>

        {/* Submission Form */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="regNo" className="block text-xs font-bold text-slate-800">
                FUTO Matriculation / Reg Number:
              </label>
              <input
                id="regNo"
                type="text"
                value={admissionNo}
                onChange={(e) => setAdmissionNo(e.target.value)}
                placeholder="e.g. 2019/114820"
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />

              {/* Quick Suggestion Pills */}
              {students.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Quick select:</span>
                  {students.slice(0, 4).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setAdmissionNo(s.admissionNo)}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 hover:bg-slate-200 transition"
                    >
                      {s.admissionNo} ({s.name.split(" ")[0]})
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="otpCode" className="block text-xs font-bold text-slate-800">
                6-Digit Classroom WiFi OTP:
              </label>
              <input
                id="otpCode"
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="482910"
                required
                className="mt-1.5 w-full text-center tracking-[0.35em] font-mono text-2xl font-black rounded-xl border border-slate-300 py-3 text-slate-900 placeholder:text-slate-300 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
              <p className="mt-1 text-center text-[11px] text-slate-400">
                Code refreshes every 60 seconds with 30s grace window
              </p>
            </div>

            {/* Result Alerts */}
            {result && (
              <div
                className={`rounded-xl p-4 text-xs font-medium ${
                  result.success
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                    : "bg-rose-50 text-rose-900 border border-rose-200"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-base mt-0.5">{result.success ? "✅" : "❌"}</span>
                  <div>
                    <p className="font-bold">{result.success ? "Attendance Verified!" : "Check-in Error"}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed">{result.message}</p>
                    {result.success && result.student && (
                      <div className="mt-2.5 pt-2 border-t border-emerald-200/70 text-[11px] space-y-0.5">
                        <p>Student: <strong>{result.student}</strong> ({result.admissionNo})</p>
                        <p>Course: <strong>{result.course}</strong></p>
                        <p>Time: <strong>{result.time}</strong> — Status: <strong className="uppercase">{result.attendanceStatus}</strong></p>
                        <p className="text-emerald-700 font-semibold">Method: WiFi Proximity OTP (&lt;50ft)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !activeSession || (activeDevice && !activeDevice.isEnabled)}
              className="w-full rounded-xl bg-sky-600 py-3 text-sm font-bold text-white shadow-md shadow-sky-600/20 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? "Verifying Proximity OTP…" : "Verify Proximity & Check-In"}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Federal University of Technology, Owerri (FUTO) · W.O.R.C Terminal Node
        </p>
      </div>
    </main>
  );
}
