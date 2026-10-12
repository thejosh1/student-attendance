import { ClassSession, addMinutesToTime } from "@/lib/data";
import { addSession, getAllSessions, toggleSessionStatus } from "@/lib/store";
import { CreateSessionDto } from "../dto/attendance.dto";

export class SessionService {
  async getSessions(): Promise<ClassSession[]> {
    return await getAllSessions();
  }

  async createSession(dto: CreateSessionDto) {
    if (!dto.courseCode || !dto.topic) {
      return { error: "Course code and topic are required", status: 400 };
    }

    const startTime = dto.startTime || "08:00";
    const lateCutoff = dto.lateCutoff || addMinutesToTime(startTime, 15);
    const endTime = dto.endTime || "10:00";

    const newSession: ClassSession = {
      id: `sess-${Date.now()}`,
      courseCode: dto.courseCode,
      topic: dto.topic,
      lecturerName: dto.lecturerName || "Lecturer in Charge",
      date: dto.date || new Date().toLocaleDateString("en-CA"),
      startTime,
      lateCutoff,
      endTime,
      deviceId: dto.deviceId || "DEV-FUTO-01",
      isActive: true,
    };

    await addSession(newSession);
    return {
      success: true,
      session: newSession,
      message: `Attendance session created for ${newSession.courseCode} (${newSession.topic}) assigned to Device ${newSession.deviceId}.`,
    };
  }

  async toggleSession(sessionId: string, action?: "end" | "activate" | "toggle") {
    if (action === "activate") {
      return {
        error: "Ended classes cannot be reactivated. Please create a new session.",
        status: 400,
      };
    }
    const updated = await toggleSessionStatus(sessionId, action || "end");
    if (!updated) {
      return {
        error: "Session not found or has already ended. Ended classes cannot be reactivated.",
        status: 400,
      };
    }
    return {
      success: true,
      session: updated,
      message: `Session ${updated.courseCode} has ended. Terminal ${updated.deviceId} will show 'Class Has Ended' for 30 minutes.`,
    };
  }

  async endSession(sessionId: string) {
    const { endSession } = await import("@/lib/store");
    const updated = await endSession(sessionId);
    if (!updated) {
      return { error: "Session not found", status: 404 };
    }
    return {
      success: true,
      session: updated,
      message: `Session ${updated.courseCode} has officially ended. Terminal ${updated.deviceId} will show 'Class Has Ended' for 30 minutes.`,
    };
  }

  async getDeviceSessionStatus(deviceId: string) {
    const { getDeviceSessionStatus } = await import("@/lib/store");
    return await getDeviceSessionStatus(deviceId);
  }

  async deleteSession(sessionId: string) {
    const { deleteSession } = await import("@/lib/store");
    await deleteSession(sessionId);
    return {
      success: true,
      message: `Class session section ${sessionId} has been deleted.`,
    };
  }

  async deduplicateSessions() {
    const { deduplicateSessions } = await import("@/lib/store");
    const sessions = await deduplicateSessions();
    return {
      success: true,
      sessions,
      message: "Duplicate class sections removed. Exactly 1 session per course retained.",
    };
  }
}

export const sessionService = new SessionService();
