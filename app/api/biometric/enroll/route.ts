import { NextResponse } from "next/server";
import { biometricController } from "@/server/nestjs-architecture/controllers/biometric.controller";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.name || !body?.admissionNo || !body?.email) {
      return NextResponse.json(
        { error: "name, admissionNo (Matric No), and email are required fields." },
        { status: 400 }
      );
    }

    const result = await biometricController.enrollStudent({
      name: String(body.name),
      admissionNo: String(body.admissionNo),
      email: String(body.email),
      className: body.className ? String(body.className) : "TCE 511",
      deviceUserId: body.deviceUserId ? String(body.deviceUserId) : undefined,
      deviceId: body.deviceId ? String(body.deviceId) : "DEV-FUTO-01",
    });

    if ("error" in result) {
      return NextResponse.json(result, { status: result.status || 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Enrollment route error:", error);
    return NextResponse.json(
      { error: "Internal server error during student enrollment", details: error?.message },
      { status: 500 }
    );
  }
}
