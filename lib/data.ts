export type Status = "present" | "late" | "absent";
export type Method = "fingerprint";

export interface Student {
  id: string;
  deviceUserId: string; // Fingerprint slot ID enrolled on optical sensor (e.g. 2001, 2002)
  admissionNo: string; // FUTO Matric / Reg No (e.g., 2019/114820)
  name: string;
  className: string; // Course Code (e.g., COE 505, ECE 513, MEE 501, CSC 507)
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
    courseCode: "COE 505",
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
    name: "Electronics Lab 3 - Biometric Scanner 02",
    courseCode: "ECE 513",
    location: "Lab 3, Department of EEE",
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
    name: "Mechanical Workshop Block - Biometric Scanner 03",
    courseCode: "MEE 501",
    location: "Mechanical Workshop 2, SEET Block",
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
    courseCode: "CSC 507",
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
    courseCode: "COE 505",
    topic: "Embedded Microcontrollers & IoT Architecture",
    lecturerName: "Engr. Prof. K. C. Okafor",
    date: new Date().toLocaleDateString("en-CA"),
    startTime: "08:00",
    lateCutoff: "08:15",
    endTime: "10:00",
    deviceId: "DEV-FUTO-01",
    isActive: true,
  },
  {
    id: "sess-02",
    courseCode: "ECE 513",
    topic: "Digital Signal Processing & Filter Design",
    lecturerName: "Dr. Mrs. A. N. Ezeh",
    date: new Date().toLocaleDateString("en-CA"),
    startTime: "10:15",
    lateCutoff: "10:30",
    endTime: "12:15",
    deviceId: "DEV-FUTO-02",
    isActive: false,
  },
  {
    id: "sess-03",
    courseCode: "MEE 501",
    topic: "Applied Thermodynamics & Fluid Power",
    lecturerName: "Engr. Dr. O. M. Nwoke",
    date: new Date().toLocaleDateString("en-CA"),
    startTime: "12:30",
    lateCutoff: "12:45",
    endTime: "14:30",
    deviceId: "DEV-FUTO-03",
    isActive: false,
  },
  {
    id: "sess-04",
    courseCode: "CSC 507",
    topic: "Distributed Systems & Cloud Computing",
    lecturerName: "Dr. C. I. Nwachukwu",
    date: new Date().toLocaleDateString("en-CA"),
    startTime: "14:45",
    lateCutoff: "15:00",
    endTime: "16:45",
    deviceId: "DEV-FUTO-04",
    isActive: false,
  },
];

export const students: Student[] = [
  { id: "s1", deviceUserId: "2001", admissionNo: "2019/114820", name: "Chidiebere Okonkwo", className: "COE 505", email: "c.okonkwo@futo.edu.ng", enrolledAt: "2024-09-12" },
  { id: "s2", deviceUserId: "2002", admissionNo: "2019/115432", name: "Nkechi Anyaogu", className: "COE 505", email: "n.anyaogu@futo.edu.ng", enrolledAt: "2024-09-12" },
  { id: "s3", deviceUserId: "2003", admissionNo: "2019/116901", name: "Emeka Nwosu", className: "COE 505", email: "e.nwosu@futo.edu.ng", enrolledAt: "2024-09-12" },
  { id: "s4", deviceUserId: "2004", admissionNo: "2019/117210", name: "Somtochukwu Eze", className: "COE 505", email: "s.eze@futo.edu.ng", enrolledAt: "2024-09-13" },
  { id: "s5", deviceUserId: "2005", admissionNo: "2019/118345", name: "Ifeanyi Okafor", className: "ECE 513", email: "i.okafor@futo.edu.ng", enrolledAt: "2024-09-13" },
  { id: "s6", deviceUserId: "2006", admissionNo: "2019/119102", name: "Chinaza Nwachukwu", className: "ECE 513", email: "c.nwachukwu@futo.edu.ng", enrolledAt: "2024-09-14" },
  { id: "s7", deviceUserId: "2007", admissionNo: "2019/120455", name: "Kenechukwu Obi", className: "ECE 513", email: "k.obi@futo.edu.ng", enrolledAt: "2024-09-14" },
  { id: "s8", deviceUserId: "2008", admissionNo: "2020/121870", name: "Amarachi Okereke", className: "ECE 513", email: "a.okereke@futo.edu.ng", enrolledAt: "2024-09-15" },
  { id: "s9", deviceUserId: "2009", admissionNo: "2020/122340", name: "Oluebube Ibe", className: "COE 505", email: "o.ibe@futo.edu.ng", enrolledAt: "2024-09-15" },
  { id: "s10", deviceUserId: "2010", admissionNo: "2020/123118", name: "Chukwuma Nze", className: "COE 505", email: "c.nze@futo.edu.ng", enrolledAt: "2024-09-16" },
  { id: "s11", deviceUserId: "2011", admissionNo: "2020/124502", name: "Tobechukwu Uzoma", className: "ECE 513", email: "t.uzoma@futo.edu.ng", enrolledAt: "2024-09-16" },
  { id: "s12", deviceUserId: "2012", admissionNo: "2020/125890", name: "Ngozi Madu", className: "ECE 513", email: "n.madu@futo.edu.ng", enrolledAt: "2024-09-17" },
  { id: "s13", deviceUserId: "2013", admissionNo: "2019/126744", name: "Onyedika Ekeh", className: "COE 505", email: "o.ekeh@futo.edu.ng", enrolledAt: "2024-09-17" },
  { id: "s14", deviceUserId: "2014", admissionNo: "2020/127301", name: "Chetachi Onyeka", className: "COE 505", email: "c.onyeka@futo.edu.ng", enrolledAt: "2024-09-18" },
];

export const classes = ["COE 505", "ECE 513", "MEE 501", "CSC 507"];

export const todayStr = () => new Date().toLocaleDateString("en-CA");
export const timeStr = (d = new Date()) => d.toTimeString().slice(0, 5);

export const statusFor = (checkIn: string | null, lateAfter: string = LATE_AFTER): Status =>
  !checkIn ? "absent" : checkIn > lateAfter ? "late" : "present";

export function seedRecords(): AttendanceRecord[] {
  const date = todayStr();
  const seed: [string, string, string | null, Method, string, string][] = [
    ["s1", "07:45", null, "fingerprint", "DEV-FUTO-01", "COE 505"],
    ["s2", "07:58", null, "fingerprint", "DEV-FUTO-01", "COE 505"],
    ["s5", "08:04", null, "fingerprint", "DEV-FUTO-01", "ECE 513"],
    ["s6", "08:22", null, "fingerprint", "DEV-FUTO-01", "ECE 513"],
    ["s8", "07:50", null, "fingerprint", "DEV-FUTO-01", "ECE 513"],
    ["s9", "08:08", null, "fingerprint", "DEV-FUTO-01", "COE 505"],
    ["s10", "07:35", null, "fingerprint", "DEV-FUTO-01", "COE 505"],
    ["s11", "08:30", null, "fingerprint", "DEV-FUTO-01", "ECE 513"],
  ];
  return seed.map(([studentId, checkIn, checkOut, method, deviceId, courseCode]) => ({
    studentId,
    date,
    checkIn,
    checkOut,
    method,
    deviceId,
    courseCode,
  }));
}
