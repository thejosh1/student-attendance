import { NextResponse } from "next/server";
import { biometricController } from "@/server/nestjs-architecture/controllers/biometric.controller";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const classFilter = searchParams.get("class") || undefined;

    const data = await biometricController.getAttendance(date, classFilter);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Attendance route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance data", details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { clearAttendance } = await import("@/lib/store");
    await clearAttendance();
    return NextResponse.json({ success: true, message: "Attendance records cleared" });
  } catch (error: any) {
    console.error("Attendance clear error:", error);
    return NextResponse.json({ error: "Failed to clear attendance" }, { status: 500 });
  }
}

