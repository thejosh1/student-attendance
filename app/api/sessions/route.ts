import { NextResponse } from "next/server";
import { biometricController } from "@/server/nestjs-architecture/controllers/biometric.controller";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await biometricController.getSessions();
    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error("Sessions route error:", error);
    return NextResponse.json({ error: "Failed to fetch class sessions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.courseCode || !body?.topic) {
      return NextResponse.json(
        { error: "courseCode and topic are required." },
        { status: 400 }
      );
    }

    const startTime = body.startTime || "08:00";
    const { addMinutesToTime } = await import("@/lib/data");
    const result = await biometricController.createSession({
      courseCode: String(body.courseCode),
      topic: String(body.topic),
      lecturerName: body.lecturerName || "Lecturer in Charge",
      lecturerEmail: body.lecturerEmail,
      lecturerId: body.lecturerId,
      date: body.date,
      startTime,
      lateCutoff: body.lateCutoff || addMinutesToTime(startTime, 15),
      endTime: body.endTime || "10:00",
      deviceId: body.deviceId || "DEV-FUTO-01",
    });

    if ("error" in result) {
      return NextResponse.json(result, { status: result.status || 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Create session route error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.sessionId) {
      return NextResponse.json({ error: "sessionId required." }, { status: 400 });
    }

    const action = (body?.action as "end" | "activate" | "toggle") || "end";
    if (action === "activate") {
      return NextResponse.json(
        { error: "Ended classes cannot be reactivated. Please create a new session." },
        { status: 400 }
      );
    }
    const result = await biometricController.toggleSession(String(body.sessionId), action);
    if ("error" in result) {
      return NextResponse.json(result, { status: result.status || 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Toggle session route error:", error);
    return NextResponse.json({ error: "Failed to toggle session" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const dedupe = searchParams.get("deduplicate");

    if (dedupe === "true") {
      const result = await biometricController.deduplicateSessions();
      return NextResponse.json(result, { status: 200 });
    }

    let targetId = id;
    if (!targetId) {
      const body = await req.json().catch(() => null);
      targetId = body?.sessionId || body?.id;
    }

    if (!targetId) {
      return NextResponse.json({ error: "Session ID required (?id=... or body.sessionId)" }, { status: 400 });
    }

    const result = await biometricController.deleteSession(String(targetId));
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Delete session route error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
