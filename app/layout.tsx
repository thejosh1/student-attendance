import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "FUTO Biometric Attendance System | ESP32 Fingerprint Cloud Platform",
  description: "Federal University of Technology Owerri (FUTO) - Real-time cloud biometric attendance, student enrollment, multi-device management, and ESP32 hardware synchronization.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        <Navbar />
        {children}
        <footer className="mt-16 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© {new Date().getFullYear()} Federal University of Technology, Owerri (FUTO) · SEET Biometric Attendance Platform</p>
            <p className="flex items-center gap-2">
              <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                ESP32 + AS608 Optical Sensor + DS3231 RTC
              </span>
              <span>· Cloud Vercel Sync</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
