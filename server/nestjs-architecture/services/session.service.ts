import { ClassSession } from "@/lib/data";
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

    const newSession: ClassSession = {
      id: `sess-${Date.now()}`,
      courseCode: dto.courseCode,
      topic: dto.topic,
      lecturerName: dto.lecturerName || "Lecturer in Charge",
      date: dto.date || new Date().toLocaleDateString("en-CA"),
      startTime: dto.startTime || "08:00",
      lateCutoff: dto.lateCutoff || "08:15",
      endTime: dto.endTime || "10:00",
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

  async toggleSession(sessionId: string) {
    const updated = await toggleSessionStatus(sessionId);
    if (!updated) {
      return { error: "Session not found", status: 404 };
    }
    return {
      success: true,
      session: updated,
      message: `Session ${updated.courseCode} is now ${updated.isActive ? "ACTIVE" : "CONCLUDED"}.`,
    };
  }
}

export const sessionService = new SessionService();
