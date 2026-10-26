import {
  AttendanceRecord,
  AttendanceRow,
  Student,
  addMinutesToTime,
  statusFor,
  timeStr,
  todayStr,
} from "@/lib/data";
import {
  getAllDevices,
  getAllSessions,
  getAllStudents,
  isSessionExpired,
  records,
  store,
} from "@/lib/store";
import { EnrollStudentDto, OtpAttendanceDto, ScanAttendanceDto } from "../dto/attendance.dto";

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
    // Only trust client-provided timestamp for true offline sync replay; live scans use authoritative server time
    if (dto.isOfflineSync && dto.timestamp) {
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

    // Double-check if the active target session reached its scheduled endTime
    if (targetSession && isSessionExpired(targetSession, now)) {
      targetSession.isActive = false;
      targetSession.endedAt = new Date(`${targetSession.date}T${targetSession.endTime}:00+01:00`).toISOString();
      const db = await import("@/lib/store").then((m) => m.getDb());
      if (db) {
        db.collection("sessions").updateOne(
          { id: targetSession.id },
          { $set: { isActive: false, endedAt: targetSession.endedAt } }
        ).catch((e) => console.warn("Auto-expire session error:", e));
      }
      targetSession = undefined;
    }

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

    const sessionCourse = targetSession.courseCode;
    const lateCutoff = targetSession.lateCutoff || (targetSession.startTime ? addMinutesToTime(targetSession.startTime, 15) : "08:15");

    const existingIndex = store.records.findIndex(
      (r) => r.studentId === student.id && r.date === date && (norm(r.courseCode) === norm(sessionCourse) || !r.courseCode)
    );

    if (existingIndex === -1) {
      const record: AttendanceRecord = {
        studentId: student.id,
        date,
        checkIn: time,
        checkOut: null,
        method: dto.method ?? "fingerprint",
        deviceId,
        courseCode: sessionCourse,
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
        course: sessionCourse,
        sessionTopic: targetSession.topic,
        time,
        attendanceStatus: status,
        deviceId,
        message: `Welcome ${student.name}! Checked in for ${sessionCourse} at ${time} (${status.toUpperCase()}).`,
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
   * Process attendance via WiFi-broadcasted proximity OTP
   */
  async processOtpCheckin(dto: OtpAttendanceDto) {
    if (!dto.admissionNo || !dto.otp) {
      return { error: "Admission/Reg No and 6-digit WiFi OTP are required.", status: 400 };
    }

    const cleanAdmissionNo = dto.admissionNo.trim();
    const cleanOtp = dto.otp.trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      return { error: "OTP must be a 6-digit number broadcasted by the classroom terminal.", status: 400 };
    }

    const students = await getAllStudents();
    const norm = (s: string) => (s || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const student = students.find(
      (s) => norm(s.admissionNo) === norm(cleanAdmissionNo) || s.id === cleanAdmissionNo
    );

    if (!student) {
      return {
        error: `Student with Reg No [${cleanAdmissionNo}] not found in enrollment records.`,
        status: 404,
      };
    }

    const sessions = await getAllSessions();
    const normCourse = (c?: string) => (c || "").trim().toUpperCase();

    // Find the target active session
    let targetSession = sessions.find((s) => {
      if (!s.isActive) return false;
      if (dto.deviceId && s.deviceId === dto.deviceId) return true;
      if (dto.courseCode && normCourse(s.courseCode) === normCourse(dto.courseCode)) return true;
      return true; // Match current active session
    });

    if (!targetSession) {
      return {
        error: "NO ACTIVE CLASS: There is no live lecture session currently active for attendance check-in.",
        status: 400,
      };
    }

    // Verify Device is enabled
    const devices = await getAllDevices();
    const device = devices.find((d) => d.id === targetSession!.deviceId);
    if (device && !device.isEnabled) {
      return {
        error: `ACCESS BLOCKED: Terminal [${device.id}] is currently DISABLED by the Lecturer.`,
        status: 403,
      };
    }

    // Verify OTP using 60s rolling window + grace period
    const { verifySessionOtp } = await import("@/lib/store");
    const isOtpValid = verifySessionOtp(targetSession.id, cleanOtp);

    if (!isOtpValid) {
      return {
        error: "INVALID OTP: The OTP entered is invalid or has expired. Please check the WiFi network name (WORC-OTP-XXXXXX) or terminal screen in your classroom.",
        status: 400,
      };
    }

    const now = new Date();
    const date = now.toLocaleDateString("en-CA");
    const time = timeStr(now);
    const sessionCourse = targetSession.courseCode;
    const lateCutoff = targetSession.lateCutoff || (targetSession.startTime ? addMinutesToTime(targetSession.startTime, 15) : "08:15");

    const existingIndex = store.records.findIndex(
      (r) => r.studentId === student.id && r.date === date && (normCourse(r.courseCode) === normCourse(sessionCourse) || !r.courseCode)
    );

    if (existingIndex !== -1) {
      const existing = store.records[existingIndex];
      return {
        action: "duplicate",
        status: 200,
        student: student.name,
        admissionNo: student.admissionNo,
        time: existing.checkIn,
        message: `Student ${student.name} is already checked in for ${sessionCourse} at ${existing.checkIn}.`,
      };
    }

    const record: AttendanceRecord = {
      studentId: student.id,
      date,
      checkIn: time,
      checkOut: null,
      method: "wifi_otp",
      deviceId: targetSession.deviceId,
      courseCode: sessionCourse,
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
      course: sessionCourse,
      sessionTopic: targetSession.topic,
      time,
      attendanceStatus: status,
      deviceId: targetSession.deviceId,
      message: `Welcome ${student.name}! Checked in for ${sessionCourse} via WiFi OTP at ${time} (${status.toUpperCase()}).`,
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
      const activeSession = sessions.find((sess) => sess.isActive);
      const targetCourse = classFilter && classFilter !== "all" 
        ? classFilter 
        : (activeSession?.courseCode || s.className);

      const r = records.find(
        (rec) => rec.studentId === s.id && rec.date === date && (normCourse(rec.courseCode) === normCourse(targetCourse) || !rec.courseCode)
      ) || records.find((rec) => rec.studentId === s.id && rec.date === date);

      const sessionForCourse =
        sessions.find((sess) => normCourse(sess.courseCode) === normCourse(targetCourse) && sess.isActive) ||
        sessions.find((sess) => normCourse(sess.courseCode) === normCourse(targetCourse)) ||
        activeSession;

      const isSessionActive = Boolean(
        (sessionForCourse && sessionForCourse.isActive) || (!sessionForCourse && hasAnyActiveSession)
      );
      const lateCutoff = sessionForCourse?.lateCutoff || (sessionForCourse?.startTime ? addMinutesToTime(sessionForCourse.startTime, 15) : "08:15");

      return {
        ...s,
        className: r?.courseCode || targetCourse || s.className,
        checkIn: r?.checkIn ?? null,
        checkOut: r?.checkOut ?? null,
        method: r?.method ?? null,
        status: statusFor(r?.checkIn ?? null, lateCutoff, isSessionActive),
        sessionTopic: sessionForCourse?.topic,
      };
    });

    const filteredRows =
      classFilter && classFilter !== "all"
        ? rows.filter((r) => normCourse(r.className) === normCourse(classFilter))
        : rows;

    return {
      date,
      totalStudents: students.length,
      rows: filteredRows,
    };
  }
}

export const biometricService = new BiometricService();
