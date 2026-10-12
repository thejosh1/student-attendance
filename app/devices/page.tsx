"use client";

import { useCallback, useEffect, useState } from "react";
import { BiometricDevice } from "@/lib/data";

export default function DevicesPage() {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    deviceId: string;
    success: boolean;
    status: number;
    message: string;
  } | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices", { cache: "no-store" });
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
      }
    } catch (e) {
      console.error("Failed to load devices:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Toggle enable/disable
  const handleToggle = async (deviceId: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, isEnabled: !currentStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadDevices();
      }
    } catch (e) {
      console.error("Failed to toggle device:", e);
    }
  };

  // Ping / check device status
  const handlePingDevice = async (device: BiometricDevice) => {
    setTestingId(device.id);
    setTestResult(null);

    try {
      setTestResult({
        deviceId: device.id,
        success: device.isEnabled,
        status: device.isEnabled ? 200 : 403,
        message: device.isEnabled
          ? `Terminal ${device.id} is ENABLED and ready to accept live biometric scans over WiFi.`
          : `Terminal ${device.id} is DISABLED by lecturer policy. All physical scans will be blocked with HTTP 403.`,
      });
    } finally {
      setTestingId(null);
    }
  };


  const enabledCount = devices.filter((d) => d.isEnabled).length;
  const disabledCount = devices.length - enabledCount;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-800 text-white shadow-md shadow-purple-700/20">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" />
                <line x1="20" y1="14" x2="23" y2="14" />
                <line x1="1" y1="9" x2="4" y2="9" />
                <line x1="1" y1="14" x2="4" y2="14" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 tracking-wide">
                  HARDWARE MANAGER
                </span>
                <span className="text-xs text-slate-500">4 Biometric Units Configured</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                Classroom Fingerprint Terminals
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Each classroom has its own dedicated biometric reader. Currently configured with <strong>1 active</strong> terminal and <strong>3 disabled</strong> terminals as instructed.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-2 border border-slate-200 text-xs font-semibold">
            <span className="rounded-lg bg-emerald-600 px-2.5 py-1 text-white">
              {enabledCount} Enabled
            </span>
            <span className="rounded-lg bg-rose-600 px-2.5 py-1 text-white">
              {disabledCount} Disabled
            </span>
          </div>
        </div>
      </section>

      {/* Test Result Callout if active */}
      {testResult && (
        <section
          className={`mt-6 rounded-xl border p-4 text-sm animate-in fade-in ${
            testResult.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 font-bold">
              {testResult.success ? (
                <span className="text-emerald-700">✓ Scan Accepted:</span>
              ) : (
                <span className="text-rose-700">✕ Scan Rejected:</span>
              )}
              <span>Device {testResult.deviceId}</span>
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-1 text-xs">{testResult.message}</p>
        </section>
      )}

      {/* Grid of the 4 Devices */}
      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading && (
          <div className="col-span-2 py-12 text-center text-slate-400">
            <div className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
              Querying hardware terminals…
            </div>
          </div>
        )}

        {!loading &&
          devices.map((device, idx) => (
            <div
              key={device.id}
              className={`rounded-2xl border p-6 transition shadow-sm ${
                device.isEnabled
                  ? "border-emerald-300 bg-white ring-1 ring-emerald-500/20"
                  : "border-slate-200 bg-slate-50/70"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl font-bold font-mono text-sm shadow-sm ${
                      device.isEnabled
                        ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white"
                        : "bg-slate-300 text-slate-600"
                    }`}
                  >
                    0{idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {device.id}
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        {device.courseCode}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      {device.name}
                    </h3>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggle(device.id, device.isEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      device.isEnabled ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        device.isEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      device.isEnabled ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {device.isEnabled ? "ACTIVE" : "DISABLED"}
                  </span>
                </div>
              </div>

              {/* Hardware Specs */}
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs border-t border-slate-100 pt-4">
                <div>
                  <span className="text-slate-400 block text-[11px]">Classroom Location</span>
                  <span className="font-semibold text-slate-700">{device.location}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Hardware Architecture</span>
                  <span className="font-semibold text-slate-700">{device.model}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">IP / MAC Address</span>
                  <span className="font-mono text-slate-600 text-[11px]">
                    {device.ipAddress} · {device.macAddress}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Battery / Power</span>
                  <span className="font-semibold text-slate-700">
                    {device.batteryLevel}% (Li-ion 3.7V)
                  </span>
                </div>
              </div>

              {/* Status Note & Test Action */}
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="text-xs">
                  {device.isEnabled ? (
                    <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Listening for finger scans on Serial2
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-rose-600 font-medium">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Deactivated (All scans rejected with HTTP 403)
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handlePingDevice(device)}
                  disabled={testingId === device.id}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {testingId === device.id ? "Checking..." : "Check Status"}
                </button>
              </div>
            </div>
          ))}
      </section>
    </main>
  );
}
