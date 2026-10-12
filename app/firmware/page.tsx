"use client";

import { useState } from "react";

export default function FirmwarePage() {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    fetch("/api/firmware")
      .then((r) => r.text())
      .then((txt) => {
        navigator.clipboard.writeText(txt);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 text-white shadow-md shadow-amber-700/20">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 tracking-wide">
                  ESP32 HARDWARE INTEGRATION
                </span>
                <span className="text-xs text-slate-500">Firmware & Vercel Cloud Sync</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                ESP32 Biometric Device Firmware
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Complete incorporated Arduino C++ source code, wiring diagram, and Vercel cloud configuration.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/api/hardware-zip"
              download="futo_esp32_hardware_package.zip"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Hardware ZIP Package (.zip)
            </a>
            <a
              href="/api/firmware"
              download="futo_attendance_esp32.ino"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-slate-800 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Download .INO Sketch
            </a>
          </div>
        </div>
      </section>

      {/* Guide Cards */}
      <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold mb-3">
            1
          </div>
          <h3 className="text-base font-bold text-slate-900">How the Device Talks to Vercel</h3>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            The ESP32 uses <code>HTTPClient</code> with <code>WiFiClientSecure</code> and <code>client.setInsecure()</code>. Whenever a student places their finger, the AS608 matches the template and the ESP32 sends an HTTPS POST directly to <code>https://your-vercel-domain/api/biometric/scan</code> with device ID and slot ID.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-800 font-bold mb-3">
            2
          </div>
          <h3 className="text-base font-bold text-slate-900">Disabled Devices Enforcement</h3>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            When a scan arrives from a disabled unit (such as DEV-FUTO-02, 03, or 04), the Vercel API rejects the scan with HTTP 403. The ESP32 receives this status and displays <strong>ACCESS BLOCKED: Device Disabled</strong> on its LCD and Serial output!
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-800 font-bold mb-3">
            3
          </div>
          <h3 className="text-base font-bold text-slate-900">Offline SD Card Fallback</h3>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            If campus WiFi disconnects or power drops, your original SD card logic saves attendance logs to <code>/logs.csv</code> with timestamp from the DS3231 RTC. When WiFi reconnects, the ESP32 automatically uploads pending logs to the cloud.
          </p>
        </div>
      </section>

      {/* Hardware Wiring Pinout Table */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">ESP32 Pinout & Hardware Connection</h2>
        <p className="text-xs text-slate-500 mt-0.5">Wiring mapping for ESP32-WROOM-32 with peripherals</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Hardware Module</th>
                <th className="px-4 py-3">Module Pin</th>
                <th className="px-4 py-3">ESP32 Pin</th>
                <th className="px-4 py-3">Interface / Protocol</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              <tr>
                <td className="px-4 py-2.5 font-bold text-slate-900">AS608 Fingerprint</td>
                <td className="px-4 py-2.5">TX (Green)</td>
                <td className="px-4 py-2.5 text-emerald-700 font-bold">GPIO 16 (RX2)</td>
                <td className="px-4 py-2.5">HardwareSerial(2)</td>
                <td className="px-4 py-2.5 font-sans">Baud rate: 57600 bps</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-bold text-slate-900">AS608 Fingerprint</td>
                <td className="px-4 py-2.5">RX (Yellow)</td>
                <td className="px-4 py-2.5 text-emerald-700 font-bold">GPIO 17 (TX2)</td>
                <td className="px-4 py-2.5">HardwareSerial(2)</td>
                <td className="px-4 py-2.5 font-sans">Voltage: 3.3V / 5V</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-bold text-slate-900">DS3231 RTC</td>
                <td className="px-4 py-2.5">SDA / SCL</td>
                <td className="px-4 py-2.5 text-blue-700 font-bold">GPIO 21 / 22</td>
                <td className="px-4 py-2.5">I2C (Wire)</td>
                <td className="px-4 py-2.5 font-sans">Real-time clock timestamping</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-bold text-slate-900">I2C LCD 16x2</td>
                <td className="px-4 py-2.5">SDA / SCL</td>
                <td className="px-4 py-2.5 text-blue-700 font-bold">GPIO 21 / 22</td>
                <td className="px-4 py-2.5">I2C (Address 0x27)</td>
                <td className="px-4 py-2.5 font-sans">Shares I2C bus with RTC</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-bold text-slate-900">MicroSD Card</td>
                <td className="px-4 py-2.5">CS</td>
                <td className="px-4 py-2.5 text-purple-700 font-bold">GPIO 5</td>
                <td className="px-4 py-2.5">SPI (SD_CS 5)</td>
                <td className="px-4 py-2.5 font-sans">Local offline CSV logging</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-bold text-slate-900">MicroSD Card</td>
                <td className="px-4 py-2.5">MOSI / MISO / SCK</td>
                <td className="px-4 py-2.5 text-purple-700 font-bold">GPIO 23 / 19 / 18</td>
                <td className="px-4 py-2.5">SPI Bus</td>
                <td className="px-4 py-2.5 font-sans">Standard ESP32 VSPI</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Cloud API & Curl Testing Reference */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Vercel API Endpoints & Curl Tests</h2>
        <p className="text-xs text-slate-500 mt-0.5">Test biometric communication from your terminal or Postman</p>

        <div className="mt-4 space-y-4">
          <div>
            <span className="text-xs font-bold text-slate-700">1. Simulate Biometric Scan (Active Device DEV-FUTO-01):</span>
            <pre className="mt-1.5 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs font-mono text-emerald-400">
{`curl -X POST https://your-futo-attendance.vercel.app/api/biometric/scan \\
  -H "Content-Type: application/json" \\
  -d '{"deviceUserId":"2001", "deviceId":"DEV-FUTO-01", "classId":"COE 505", "method":"fingerprint"}'`}
            </pre>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-700">2. Test Disabled Device Rejection (Device DEV-FUTO-02):</span>
            <pre className="mt-1.5 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs font-mono text-rose-400">
{`curl -X POST https://your-futo-attendance.vercel.app/api/biometric/scan \\
  -H "Content-Type: application/json" \\
  -d '{"deviceUserId":"2005", "deviceId":"DEV-FUTO-02", "classId":"ECE 513", "method":"fingerprint"}'
# Response: HTTP 403 Forbidden: {"error": "Device is disabled by lecturer"}`}
            </pre>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-700">3. MongoDB Configuration on Vercel:</span>
            <div className="mt-1.5 rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-700">
              <p>In your Vercel Project Settings &gt; <strong>Environment Variables</strong>, add:</p>
              <code className="block mt-2 font-mono text-emerald-700 bg-white p-2 rounded border border-slate-200">
                MONGODB_URI=mongodb+srv://&lt;username&gt;:&lt;password&gt;@cluster0.mongodb.net/futo_attendance?retryWrites=true&amp;w=majority
              </code>
              <p className="mt-2 text-slate-500">
                If <code>MONGODB_URI</code> is not set, the platform operates seamlessly using memory-persistent storage!
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
