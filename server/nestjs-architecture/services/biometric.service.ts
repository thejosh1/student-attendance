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

    const now = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const date = now.toLocaleDateString("en-CA");
    const time = timeStr(now);

    // Check active session for late cutoff
    const sessions = await getAllSessions();
    const activeSession = sessions.find(
      (sess) => sess.courseCode === student.className && sess.isActive
    );
    const lateCutoff = activeSession?.lateCutoff || "08:15";

    const existingIndex = store.records.findIndex(
      (r) => r.studentId === student.id && r.date === date
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

      const status = statusFor(time, lateCutoff);
      return {
        action: "check-in",
        status: 200,
        student: student.name,
        admissionNo: student.admissionNo,
        course: student.className,
        time,
        attendanceStatus: status,
        deviceId,
        message: `Welcome ${student.name}! Checked in at ${time} (${status.toUpperCase()}).`,
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

    // Generate or format slot ID
    let slotId = dto.deviceUserId;
    if (!slotId) {
      const maxId = students.reduce((max, s) => {
        const num = parseInt(s.deviceUserId, 10);
        return !isNaN(num) && num > max ? num : max;
      }, 2000);
      slotId = String(maxId + 1);
    }

    const newStudent: Student = {
      id: `s_${Date.now()}`,
      deviceUserId: slotId,
      admissionNo: dto.admissionNo.trim(),
      name: dto.name.trim(),
      className: dto.className || "TCE 502",
      email: dto.email.trim(),
      enrolledAt: new Date().toLocaleDateString("en-CA"),
      deviceId: dto.deviceId || "DEV-FUTO-01",
    };

    store.students.unshift(newStudent);

    return {
      success: true,
      status: 201,
      student: newStudent,
      message: `Student ${newStudent.name} (${newStudent.admissionNo}) successfully enrolled into ${newStudent.className} with Biometric Template #${newStudent.deviceUserId}!`,
    };
  }

  /**
   * Get formatted attendance rows for dashboard
   */
  async getDashboardAttendance(dateFilter?: string, classFilter?: string) {
    const date = dateFilter || todayStr();
    const students = await getAllStudents();
    const sessions = await getAllSessions();

    const rows: AttendanceRow[] = students.map((s) => {
      const r = store.records.find((rec) => rec.studentId === s.id && rec.date === date);
      const activeSession = sessions.find((sess) => sess.courseCode === s.className);
      const lateCutoff = activeSession?.lateCutoff || "08:15";

      return {
        ...s,
        checkIn: r?.checkIn ?? null,
        checkOut: r?.checkOut ?? null,
        method: r?.method ?? null,
        status: statusFor(r?.checkIn ?? null, lateCutoff),
        sessionTopic: activeSession?.topic,
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
