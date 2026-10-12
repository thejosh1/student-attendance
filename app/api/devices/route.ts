import { NextResponse } from "next/server";
import { biometricController } from "@/server/nestjs-architecture/controllers/biometric.controller";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const devices = await biometricController.getDevices();
    return NextResponse.json({ devices });
  } catch (error: any) {
    console.error("Devices route error:", error);
    return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.deviceId || typeof body?.isEnabled !== "boolean") {
      return NextResponse.json(
        { error: "deviceId and boolean isEnabled are required." },
        { status: 400 }
      );
    }

    const result = await biometricController.toggleDevice({
      deviceId: String(body.deviceId),
      isEnabled: Boolean(body.isEnabled),
    });

    if ("error" in result) {
      return NextResponse.json(result, { status: result.status || 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Toggle device route error:", error);
    return NextResponse.json({ error: "Failed to toggle device status" }, { status: 500 });
  }
}
