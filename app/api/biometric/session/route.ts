import { NextResponse } from "next/server";
import { biometricController } from "@/server/nestjs-architecture/controllers/biometric.controller";

export const dynamic = "force-dynamic";

/**
 * GET /api/biometric/session?deviceId=DEV-FUTO-01
 * 
 * Polled by ESP32 terminals to get authoritative session state:
 * - status: "active" (Class is currently live, displays class & "Place Finger")
 * - status: "ended" (Class concluded within the last 30 minutes, displays class & "Class Has Ended")
 * - status: "idle" (No class active, or > 30 minutes since concluded, displays "Scan Fingerprint")
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("deviceId") || "DEV-FUTO-01";

    const sessionStatus = await biometricController.getDeviceSessionStatus(deviceId);

    return NextResponse.json(sessionStatus, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Biometric session query error:", error);
    return NextResponse.json(
      {
        deviceId: "DEV-FUTO-01",
        hasActiveSession: false,
        status: "idle",
        courseCode: "",
        topic: "",
        displayLine1: "Scan Fingerprint",
        displayLine2: "DEV-FUTO-01 Ready",
        error: error.message || "Failed to query session status",
      },
      { status: 500 }
    );
  }
}
