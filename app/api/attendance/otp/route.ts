import { NextResponse } from "next/server";
import { biometricController } from "@/server/nestjs-architecture/controllers/biometric.controller";

export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/otp
 * 
 * Accepts student matriculation number and the 6-digit WiFi OTP
 * broadcasted by the nearby ESP32 terminal within the classroom.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.admissionNo || !body?.otp) {
      return NextResponse.json(
        { error: "Both admissionNo (Matric/Reg No) and the 6-digit classroom WiFi OTP are required." },
        { status: 400 }
      );
    }

    const result = await biometricController.processOtpCheckin({
      admissionNo: String(body.admissionNo),
      otp: String(body.otp),
      deviceId: body.deviceId ? String(body.deviceId) : undefined,
      courseCode: body.courseCode ? String(body.courseCode) : undefined,
    });

    if ("error" in result) {
      return NextResponse.json(result, { status: result.status || 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("OTP attendance route error:", error);
    return NextResponse.json(
      { error: "Internal server error during WiFi OTP attendance processing", details: error?.message },
      { status: 500 }
    );
  }
}
