import {
  AttendanceRecord,
  AttendanceRow,
  Student,
  statusFor,
  timeStr,
  todayStr,
} from "@/lib/data";
import {
  getAllDevices,
  getAllSessions,
  getAllStudents,
  records,
  store,
} from "@/lib/store";
import { EnrollStudentDto, ScanAttendanceDto } from "../dto/attendance.dto";

const MIN_GAP_MINUTES = 30;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export class BiometricService {
  /**
   * Process a fingerprint scan from an ESP32 hardware device or web simulation
   */
  async processScan(dto: ScanAttendanceDto) {
    if (!dto.deviceUserId) {
      return { error: "deviceUserId is required", status: 400 };
    }

    const deviceId = dto.deviceId || "DEV-FUTO-01";
    const devices = await getAllDevices();
    const device = devices.find((d) => d.id === deviceId);

    // CRITICAL REQUIREMENT: If the device is disabled, reject the scan!
    if (device && !device.isEnabled) {
      return {
        error: `ACCESS BLOCKED: Device [${device.id} - ${device.name}] is currently DISABLED by the Lecturer. Scans cannot be processed.`,
        status: 403,
        deviceStatus: "disabled",
        deviceId: device.id,
      };
    }

    const students = await getAllStudents();
    const student = students.find((s) => s.deviceUserId === String(dto.deviceUserId));

    if (!student) {
      return {
        error: `Biometric template #${dto.deviceUserId} not found in student database.`,
        status: 404,
      };
    }

    let now = new Date();
    if (dto.timestamp) {
      const parsed = new Date(dto.timestamp.replace(" ", "T"));
      if (!isNaN(parsed.getTime())) {
        now = parsed;
      }
    }
    const date = now.toLocaleDateString("en-CA");
    const time = timeStr(now);

    // CRITICAL REQUIREMENT: Terminal-level session routing
    const sessions = await getAllSessions();
    const norm = (c?: string) => (c || "").trim().toUpperCase();

    let targetSession = sessions.find(
      (sess) => sess.deviceId === deviceId && sess.isActive
    );

    // Fallback ONLY for genuine offline sync queued while lecture was ongoing
    if (!targetSession && dto.isOfflineSync && dto.timestamp) {
      targetSession = sessions.find(
        (sess) =>
          (sess.deviceId === deviceId || norm(sess.courseCode) === norm(student.className)) &&
          sess.date === date
      );
    }

    if (!targetSession) {
      const recentEnded = sessions.find(
        (s) => s.deviceId === deviceId && !s.isActive && s.endedAt
      );
      if (recentEnded) {
        return {
          action: "session-ended",
          status: 400,
          error: `CLASS HAS ENDED: Attendance session for ${recentEnded.courseCode} has officially concluded. Terminal [${deviceId}] is closed.`,
          student: student.name,
          activeClass: recentEnded.courseCode,
          deviceId,
        };
      }

      return {
        action: "no-session",
        status: 400,
        error: `NO ACTIVE CLASS: Terminal [${deviceId}] currently has no active attendance session scheduled. The lecturer must activate a session from the Lecturer Sessions portal.`,
        deviceId,
      };
    }

    // Verify student is enrolled in the specific course currently active on this terminal
    if (norm(student.className) !== norm(targetSession.courseCode)) {
      return {
        action: "wrong-class",
        status: 400,
        error: `CLASS MISMATCH: Terminal [${deviceId}] is currently dedicated to ${targetSession.courseCode} (${targetSession.topic}). ${student.name} is enrolled in ${student.className}. A biometric device cannot take attendance for 2 classes at once.`,
        student: student.name,
        admissionNo: student.admissionNo,
        studentClass: student.className,
        activeClass: targetSession.courseCode,
        deviceId,
      };
    }

    const lateCutoff = targetSession.lateCutoff || "08:15";

    const existingIndex = store.records.findIndex(
      (r) => r.studentId === student.id && r.date === date && (r.courseCode === student.className || !r.courseCode)
    );

    if (existingIndex === -1) {
      const record: AttendanceRecord = {
        studentId: student.id,
        date,
        checkIn: time,
        checkOut: null,
        method: dto.method ?? "fingerprint",
        deviceId,
        courseCode: student.className,
      };
      store.records.push(record);

      const db = await import("@/lib/store").then((m) => m.getDb());
      if (db) {
        try {
          await db.collection("attendance").insertOne({ ...record });
        } catch (e) {
          console.warn("Mongo insert attendance record error:", e);
        }
      }

      const status = statusFor(time, lateCutoff);
      return {
        action: "check-in",
        status: 200,
        student: student.name,
        admissionNo: student.admissionNo,
        course: student.className,
        sessionTopic: targetSession.topic,
        time,
        attendanceStatus: status,
        deviceId,
        message: `Welcome ${student.name}! Checked in for ${student.className} at ${time} (${status.toUpperCase()}).`,
      };
    }

    const existing = store.records[existingIndex];
    if (toMinutes(time) - toMinutes(existing.checkIn) < MIN_GAP_MINUTES) {
      return {
        action: "duplicate",
        status: 200,
        student: student.name,
        admissionNo: student.admissionNo,
        time,
        message: `Student ${student.name} already checked in at ${existing.checkIn}. Please wait before scanning checkout.`,
      };
    }

    existing.checkOut = time;
    const db = await import("@/lib/store").then((m) => m.getDb());
    if (db) {
      try {
        await db.collection("attendance").updateOne(
          { studentId: student.id, date },
          { $set: { checkOut: time } }
        );
      } catch (e) {
        console.warn("Mongo update attendance record checkout error:", e);
      }
    }

    return {
      action: "check-out",
      status: 200,
      student: student.name,
      admissionNo: student.admissionNo,
      time,
      message: `Goodbye ${student.name}! Checked out at ${time}.`,
    };
  }

  /**
   * Enroll a new student with biometric details
   */
  async enrollStudent(dto: EnrollStudentDto) {
    if (!dto.name || !dto.admissionNo || !dto.email) {
      return { error: "Name, Admission/Reg No, and Email are required", status: 400 };
    }

    const students = await getAllStudents();

    // Generate or format slot ID (starting at 1 for physical AS608 optical sensor)
    let slotId = dto.deviceUserId;
    if (!slotId) {
      const maxId = students.reduce((max, s) => {
        const num = parseInt(s.deviceUserId, 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      slotId = String(maxId + 1);
    }

    const newStudent: Student = {
      id: `s_${Date.now()}`,
      deviceUserId: slotId,
      admissionNo: dto.admissionNo.trim(),
      name: dto.name.trim(),
      className: dto.className || "TCE 511",
      email: dto.email.trim(),
      enrolledAt: new Date().toLocaleDateString("en-CA"),
      deviceId: dto.deviceId || "DEV-FUTO-01",
    };

    const { addStudent } = await import("@/lib/store");
    await addStudent(newStudent);

    return {
      success: true,
      status: 201,
      student: newStudent,
      message: `Student ${newStudent.name} (${newStudent.admissionNo}) successfully enrolled with Biometric Template Slot #${newStudent.deviceUserId}!`,
    };
  }


  /**
   * Get formatted attendance rows for dashboard
   */
  async getDashboardAttendance(dateFilter?: string, classFilter?: string) {
    const date = dateFilter || todayStr();
    const students = await getAllStudents();
    const sessions = await getAllSessions();
    const { getAllAttendanceRecords } = await import("@/lib/store");
    const records = await getAllAttendanceRecords(date);

    const normCourse = (c?: string) => (c || "").trim().toUpperCase();
    const hasAnyActiveSession = sessions.some((sess) => sess.isActive);

    const rows: AttendanceRow[] = students.map((s) => {
      const r = records.find((rec) => rec.studentId === s.id && rec.date === date);
      const sessionForCourse =
        sessions.find((sess) => normCourse(sess.courseCode) === normCourse(s.className) && sess.isActive) ||
        sessions.find((sess) => normCourse(sess.courseCode) === normCourse(s.className));

      const isSessionActive = Boolean(
        (sessionForCourse && sessionForCourse.isActive) || (!sessionForCourse && hasAnyActiveSession)
      );
      const lateCutoff = sessionForCourse?.lateCutoff || "08:15";

      return {
        ...s,
        checkIn: r?.checkIn ?? null,
        checkOut: r?.checkOut ?? null,
        method: r?.method ?? null,
        status: statusFor(r?.checkIn ?? null, lateCutoff, isSessionActive),
        sessionTopic: sessionForCourse?.topic,
      };
    });


    const filteredRows =
      classFilter && classFilter !== "all"
        ? rows.filter((r) => r.className === classFilter)
        : rows;

    return {
      date,
      totalStudents: students.length,
      rows: filteredRows,
    };
  }
}

export const biometricService = new BiometricService();
