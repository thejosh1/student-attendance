import { NextResponse } from "next/server";
import { biometricController } from "@/server/nestjs-architecture/controllers/biometric.controller";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.deviceUserId) {
      return NextResponse.json(
        { error: "deviceUserId required. E.g. { \"deviceUserId\": \"2001\", \"deviceId\": \"DEV-FUTO-01\" }" },
        { status: 400 }
      );
    }

    const result = await biometricController.scanFingerprint({
      deviceUserId: String(body.deviceUserId),
      deviceId: body.deviceId ? String(body.deviceId) : "DEV-FUTO-01",
      method: body.method || "fingerprint",
      timestamp: body.timestamp,
      classId: body.classId,
    });

    if ("error" in result) {
      return NextResponse.json(result, { status: result.status || 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Biometric scan route error:", error);
    return NextResponse.json(
      { error: "Internal server error during biometric scan processing", details: error?.message },
      { status: 500 }
    );
  }
}
