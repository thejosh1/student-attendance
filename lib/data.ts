export type Status = "present" | "late" | "absent";
export type Method = "fingerprint";

export interface Student {
  id: string;
  deviceUserId: string; // Fingerprint slot ID enrolled on optical sensor (e.g. 2001, 2002)
  admissionNo: string; // FUTO Matric / Reg No (e.g., 2019/114820)
  name: string;
  className: string; // Course Code (e.g., TCE 511, TCE 504, TCE 512, TCE 514)
  email: string;
  enrolledAt?: string;
  deviceId?: string; // Fingerprint device used for enrollment
}

export interface BiometricDevice {
  id: string; // e.g. "DEV-FUTO-01"
  name: string;
  courseCode: string;
  location: string;
  ipAddress: string;
  macAddress: string;
  isEnabled: boolean; // 1 active, 3 disabled
  batteryLevel: number; // percentage
  status: "online" | "disabled" | "standby";
  model: string;
  lastPing: string;
}

export interface ClassSession {
  id: string;
  courseCode: string;
  topic: string;
  lecturerName: string;
  date: string;
  startTime: string;
  lateCutoff: string;
  endTime: string;
  deviceId: string;
  isActive: boolean;
}

export interface AttendanceRecord {
  studentId: string;
  date: string; // YYYY-MM-DD
  checkIn: string; // HH:mm
  checkOut: string | null;
  method: Method;
  deviceId?: string;
  courseCode?: string;
}

export interface AttendanceRow extends Student {
  checkIn: string | null;
  checkOut: string | null;
  method: Method | null;
  status: Status;
  sessionTopic?: string;
}

export const LATE_AFTER = "08:15";

/* Default 4 Biometric Devices: exactly 1 enabled, 3 disabled as specified */
export const initialDevices: BiometricDevice[] = [
  {
    id: "DEV-FUTO-01",
    name: "Lecture Theatre Hall A - Biometric Scanner 01",
    courseCode: "TCE 511",
    location: "Hall A, SEET Engineering Complex",
    ipAddress: "192.168.1.101",
    macAddress: "4C:75:25:A1:3F:01",
    isEnabled: true, // ACTIVE
    batteryLevel: 98,
    status: "online",
    model: "ESP32-WROOM-32 + AS608 Optical Sensor",
    lastPing: "Just now",
  },
  {
    id: "DEV-FUTO-02",
    name: "Telecom Lab 3 - Biometric Scanner 02",
    courseCode: "TCE 504",
    location: "Lab 3, Department of Telecommunication Engineering",
    ipAddress: "192.168.1.102",
    macAddress: "4C:75:25:A1:3F:02",
    isEnabled: false, // DISABLED
    batteryLevel: 85,
    status: "disabled",
    model: "ESP32-WROOM-32 + AS608 Optical Sensor",
    lastPing: "Disabled by Lecturer",
  },
  {
    id: "DEV-FUTO-03",
    name: "RF & Microwave Lab - Biometric Scanner 03",
    courseCode: "TCE 512",
    location: "RF & Microwave Lab, SEET Complex",
    ipAddress: "192.168.1.103",
    macAddress: "4C:75:25:A1:3F:03",
    isEnabled: false, // DISABLED
    batteryLevel: 91,
    status: "disabled",
    model: "ESP32-WROOM-32 + AS608 Optical Sensor",
    lastPing: "Disabled by Lecturer",
  },
  {
    id: "DEV-FUTO-04",
    name: "SEET Central Auditorium - Biometric Scanner 04",
    courseCode: "TCE 514",
    location: "SEET Central Auditorium South Gate",
    ipAddress: "192.168.1.104",
    macAddress: "4C:75:25:A1:3F:04",
    isEnabled: false, // DISABLED
    batteryLevel: 74,
    status: "disabled",
    model: "ESP32-WROOM-32 + AS608 Optical Sensor",
    lastPing: "Disabled by Lecturer",
  },
];

/* Default Lecturer Class Sessions */
export const initialSessions: ClassSession[] = [
  {
    id: "sess-01",
    courseCode: "TCE 511",
    topic: "Telecommunication Engineering Lecture",
    lecturerName: "Course Lecturer",
    date: new Date().toLocaleDateString("en-CA"),
    startTime: "08:00",
    lateCutoff: "08:15",
    endTime: "10:00",
    deviceId: "DEV-FUTO-01",
    isActive: true,
  },
];

/* Empty default student directory for real enrollment */
export const students: Student[] = [];

export const classes = ["TCE 511", "TCE 504", "TCE 512", "TCE 514"];

export const todayStr = () => new Date().toLocaleDateString("en-CA");
export const timeStr = (d = new Date()) => d.toTimeString().slice(0, 5);

export const statusFor = (checkIn: string | null, lateAfter: string = LATE_AFTER): Status =>
  !checkIn ? "absent" : checkIn > lateAfter ? "late" : "present";

/* Empty seed records for clean real-life testing */
export function seedRecords(): AttendanceRecord[] {
  return [];
}

