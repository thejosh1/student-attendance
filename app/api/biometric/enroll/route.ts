import { NextResponse } from "next/server";
import { biometricController } from "@/server/nestjs-architecture/controllers/biometric.controller";
import {
  clearPendingEnrollCommand,
  getAllStudents,
  getPendingEnrollCommand,
  setPendingEnrollCommand,
} from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * GET:
 * 1. Called by ESP32 Terminal: GET ?deviceId=DEV-FUTO-01
 *    Returns { hasPending: true, slotId, name, admissionNo, email, className } if student waiting for finger scan,
 *    or { hasPending: false }
 * 2. Called by Browser UI: GET ?deviceId=DEV-FUTO-01&check=2021/130455
 *    Checks if student is already enrolled on hardware and saved to database.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("deviceId") || "DEV-FUTO-01";
    const checkIdentifier = searchParams.get("check");

    // Browser status poll
    if (checkIdentifier) {
      const students = await getAllStudents();
      const term = checkIdentifier.trim().toLowerCase();
      const found = students.find(
        (s) =>
          s.admissionNo.toLowerCase() === term ||
          s.name.toLowerCase() === term ||
          s.deviceUserId === term
      );

      if (found) {
        await clearPendingEnrollCommand(deviceId);
        return NextResponse.json({
          hasPending: false,
          completed: true,
          student: found,
          message: `Hardware enrollment verified for ${found.name} (Slot #${found.deviceUserId})`,
        });
      }

      const pending = await getPendingEnrollCommand(deviceId);
      return NextResponse.json({
        hasPending: Boolean(pending),
        completed: false,
        pendingCommand: pending,
      });
    }

    // Hardware device poll
    const pendingCmd = await getPendingEnrollCommand(deviceId);
    if (pendingCmd) {
      return NextResponse.json({
        hasPending: true,
        slotId: pendingCmd.slotId,
        name: pendingCmd.name,
        admissionNo: pendingCmd.admissionNo,
        email: pendingCmd.email,
        className: pendingCmd.className,
      });
    }

    return NextResponse.json({ hasPending: false });
  } catch (error: any) {
    console.error("Enroll GET error:", error);
    return NextResponse.json({ error: "Failed to query enrollment status" }, { status: 500 });
  }
}

/**
 * PUT:
 * Called by Web UI to queue a real hardware enrollment command for the ESP32 terminal
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.name || !body?.admissionNo) {
      return NextResponse.json(
        { error: "name and admissionNo are required to queue enrollment" },
        { status: 400 }
      );
    }

    const deviceId = body.deviceId || "DEV-FUTO-01";
    const slotId = parseInt(body.slotId || body.deviceUserId, 10) || 1;

    const cmd = {
      deviceId,
      slotId,
      name: String(body.name).trim(),
      admissionNo: String(body.admissionNo).trim(),
      email: body.email ? String(body.email).trim() : "student@futo.edu.ng",
      className: body.className || "TCE 511",
      createdAt: Date.now(),
    };

    await setPendingEnrollCommand(cmd);

    return NextResponse.json({
      success: true,
      command: cmd,
      message: `Enrollment command queued for terminal ${deviceId}! Place student's finger on AS608 optical sensor.`,
    });
  } catch (error: any) {
    console.error("Enroll PUT error:", error);
    return NextResponse.json({ error: "Failed to queue enrollment command" }, { status: 500 });
  }
}

/**
 * POST:
 * Enrolls student (called by ESP32 sendEnrollToCloud OR web client)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.name || !body?.admissionNo || !body?.email) {
      return NextResponse.json(
        { error: "name, admissionNo (Matric No), and email are required fields." },
        { status: 400 }
      );
    }

    const deviceId = body.deviceId ? String(body.deviceId) : "DEV-FUTO-01";

    const result = await biometricController.enrollStudent({
      name: String(body.name),
      admissionNo: String(body.admissionNo),
      email: String(body.email),
      className: body.className ? String(body.className) : "TCE 511",
      deviceUserId: body.deviceUserId ? String(body.deviceUserId) : undefined,
      deviceId,
    });

    if ("error" in result) {
      return NextResponse.json(result, { status: result.status || 400 });
    }

    // Clear pending command once enrolled
    await clearPendingEnrollCommand(deviceId);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Enrollment route error:", error);
    return NextResponse.json(
      { error: "Internal server error during student enrollment", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE:
 * Cancels pending enrollment command
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("deviceId") || "DEV-FUTO-01";
    await clearPendingEnrollCommand(deviceId);
    return NextResponse.json({ success: true, message: `Pending enrollment cleared for ${deviceId}` });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to clear pending command" }, { status: 500 });
  }
}
