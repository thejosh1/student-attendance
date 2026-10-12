"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Student, classes } from "@/lib/data";

export default function EnrollPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [admissionNo, setAdmissionNo] = useState("");
  const [email, setEmail] = useState("");
  const [className, setClassName] = useState("TCE 511");
  const [deviceUserId, setDeviceUserId] = useState("");
  const [deviceId, setDeviceId] = useState("DEV-FUTO-01");

  // Biometric Capture Phase Simulation in Modal
  const [bioStep, setBioStep] = useState<"idle" | "place1" | "remove" | "place2" | "done">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Fetch enrolled students
  const loadStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/students", { cache: "no-store" });
      const data = await res.json();
      if (data.students) {
        setStudents(data.students);
      }
    } catch (e) {
      console.error("Failed to load students:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Calculate next slot ID
  const nextSlotId = useMemo(() => {
    const max = students.reduce((m, s) => {
      const num = parseInt(s.deviceUserId, 10);
      return !isNaN(num) && num > m ? num : m;
    }, 2000);
    return String(max + 1);
  }, [students]);

  // Reset form when modal opens
  const openModal = () => {
    setName("");
    setAdmissionNo("");
    setEmail("");
    setClassName("TCE 511");
    setDeviceUserId(nextSlotId);
    setDeviceId("DEV-FUTO-01");
    setBioStep("idle");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!submitting) {
      setIsModalOpen(false);
    }
  };

  // Run Biometric Scan Simulation
  const handleSimulateFingerprint = async () => {
    if (!name || !admissionNo || !email) {
      setToast({ message: "Please fill in Name, Reg No, and Email before capturing fingerprint.", type: "error" });
      setTimeout(() => setToast(null), 4000);
      return;
    }

    setBioStep("place1");
    await new Promise((r) => setTimeout(r, 800));

    setBioStep("remove");
    await new Promise((r) => setTimeout(r, 800));

    setBioStep("place2");
    await new Promise((r) => setTimeout(r, 900));

    setBioStep("done");
  };

  // Submit enrollment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !admissionNo.trim() || !email.trim()) {
      setToast({ message: "Please complete all registration fields.", type: "error" });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/biometric/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          admissionNo: admissionNo.trim(),
          email: email.trim(),
          className,
          deviceUserId: deviceUserId.trim() || nextSlotId,
          deviceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Enrollment failed");
      }

      setToast({
        message: `Success! ${data.student.name} (${data.student.admissionNo}) enrolled with Template #${data.student.deviceUserId}`,
        type: "success",
      });
      setTimeout(() => setToast(null), 5000);

      setIsModalOpen(false);
      await loadStudents();
    } catch (err: any) {
      console.error("Enrollment error:", err);
      setToast({ message: err.message || "Enrollment failed. Try again.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesCourse = courseFilter === "all" || s.className === courseFilter;
      const term = search.toLowerCase();
      const matchesSearch =
        s.name.toLowerCase().includes(term) ||
        s.admissionNo.toLowerCase().includes(term) ||
        (s.email && s.email.toLowerCase().includes(term)) ||
        s.className.toLowerCase().includes(term);
      return matchesCourse && matchesSearch;
    });
  }, [students, courseFilter, search]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-md shadow-emerald-700/20">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 tracking-wide">
                  BIOMETRIC ENROLLMENT
                </span>
                <span className="text-xs text-slate-500">Optical Fingerprint Registry</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                Student Biometric Registration
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Register student credentials and assign optical biometric templates for automated attendance tracking.
              </p>
            </div>
          </div>

          <div>
            <button
              onClick={openModal}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Enroll New Student
            </button>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Enrolled</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{students.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Active Sensor Node</p>
          <p className="mt-1 text-xl font-bold text-emerald-800">DEV-FUTO-01</p>
          <p className="text-xs text-emerald-600 mt-0.5">Hall A (TCE 511)</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Next Template Slot</p>
          <p className="mt-1 text-3xl font-bold text-blue-800 font-mono">#{nextSlotId}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Optical Security</p>
          <p className="mt-1 text-xl font-bold text-amber-800">AS608 500 DPI</p>
          <p className="text-xs text-amber-600 mt-0.5">Dual-Scan Verification</p>
        </div>
      </section>

      {/* Search and Filter Toolbar */}
      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-80">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, reg number, email…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Course:</label>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">All Departments / Courses</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <span className="text-xs font-medium text-slate-500">
          Showing {filteredStudents.length} of {students.length} students
        </span>
      </section>

      {/* Enrolled Students Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Student Details</th>
                <th className="px-5 py-3.5">FUTO Matric / Reg No</th>
                <th className="px-5 py-3.5">Email Address</th>
                <th className="px-5 py-3.5">Course Code</th>
                <th className="px-5 py-3.5">Biometric Slot ID</th>
                <th className="px-5 py-3.5">Biometric Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                      Loading student roster…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    No enrolled students found matching search.
                  </td>
                </tr>
              )}
              {filteredStudents.map((s) => (
                <tr key={s.id} className="transition hover:bg-slate-50/75">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-xs font-bold text-white shadow-sm">
                        {s.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500">Enrolled: {s.enrolledAt || "Active"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700">
                    {s.admissionNo}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600">
                    {s.email || `${s.name.toLowerCase().replace(/\s+/g, ".")}@futo.edu.ng`}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200 font-mono">
                      {s.className}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-mono font-semibold text-blue-700 border border-blue-200">
                      <svg className="h-3 w-3 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 11c0 3.5-1.5 6.5-4 8.5" />
                        <path d="M12 3a9 9 0 0 0-9 9c0 3.5 1.5 6.5 4 8.5" />
                        <path d="M12 7c-2.76 0-5 2.24-5 5 0 2.5 1.2 4.5 3 6" />
                      </svg>
                      Slot #{s.deviceUserId}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Fingerprint Enrolled
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ENROLLMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Student Biometric Enrollment</h3>
                  <p className="text-xs text-slate-500">Enter registration info & capture fingerprint template</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chukwuemeka Franklin Obi"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Matric / Reg Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Registration / Matric No <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={admissionNo}
                    onChange={(e) => setAdmissionNo(e.target.value)}
                    placeholder="e.g. 2021/130455"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Any valid input accepted for demo</p>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. student@futo.edu.ng"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Any valid email accepted for demo</p>
                </div>
              </div>

              {/* Course Selection & Slot ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Course / Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {classes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Biometric Slot ID (Sensor Template)
                  </label>
                  <input
                    type="number"
                    value={deviceUserId}
                    onChange={(e) => setDeviceUserId(e.target.value)}
                    placeholder={nextSlotId}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Auto-allocated: #{nextSlotId}</p>
                </div>
              </div>

              {/* Hardware Biometric Terminal Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Target Optical Biometric Unit
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Assigned Reader: <strong className="text-emerald-700">DEV-FUTO-01</strong> (Hall A - Active)
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                    Sensor Ready
                  </span>
                </div>

                {/* Simulated Fingerprint Optical Window */}
                <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-4">
                  <div
                    className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${
                      bioStep === "done"
                        ? "bg-emerald-100 text-emerald-600 ring-4 ring-emerald-400/30 scale-105"
                        : bioStep !== "idle"
                        ? "bg-amber-100 text-amber-600 ring-4 ring-amber-400/30 animate-pulse"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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

                  {/* Step status label */}
                  <p className="mt-2 text-xs font-semibold text-slate-800">
                    {bioStep === "idle" && "Ready to Capture Fingerprint"}
                    {bioStep === "place1" && "Step 1: Place Finger on Optical Prism..."}
                    {bioStep === "remove" && "Step 2: Lift Finger momentarily..."}
                    {bioStep === "place2" && "Step 3: Place Same Finger Again to Confirm..."}
                    {bioStep === "done" && "Template Verified & Ready to Save!"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {bioStep === "done"
                      ? "Features extracted and matched. Click Complete Enrollment below."
                      : "Simulates optical fingerprint sensor read on ESP32 Serial2"}
                  </p>

                  <button
                    type="button"
                    onClick={handleSimulateFingerprint}
                    disabled={bioStep !== "idle" && bioStep !== "done"}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 11c0 3.5-1.5 6.5-4 8.5" />
                      <path d="M12 3a9 9 0 0 0-9 9c0 3.5 1.5 6.5 4 8.5" />
                    </svg>
                    {bioStep === "done" ? "Re-scan Fingerprint" : "Simulate Optical Sensor Scan"}
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Registering...
                    </>
                  ) : (
                    "Complete Enrollment"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm text-white shadow-2xl ring-1 animate-in fade-in slide-in-from-bottom-5 ${
            toast.type === "success"
              ? "bg-slate-900 ring-white/10"
              : "bg-rose-900 ring-rose-500/20"
          }`}
        >
          <div
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
              toast.type === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-300"
            }`}
          >
            {toast.type === "success" ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
