export interface ScanAttendanceDto {
  deviceUserId?: string; // The fingerprint slot ID (e.g., 2001, 1, 2)
  admissionNo?: string;  // Student matric / reg number
  deviceId?: string;     // The hardware device unit (e.g., DEV-FUTO-01)
  method?: "fingerprint" | "wifi_otp";
  otp?: string;          // 6-digit WiFi broadcast OTP
  timestamp?: string;    // ISO timestamp
  classId?: string;      // e.g. TCE 511
  isOfflineSync?: boolean;
}

export interface OtpAttendanceDto {
  admissionNo: string;
  otp: string;
  deviceId?: string;
  courseCode?: string;
}

export interface EnrollStudentDto {
  name: string;
  admissionNo: string;  // Matric / Reg No (e.g. 2020/121870)
  email: string;
  className: string;    // Course (e.g. TCE 511)
  deviceUserId?: string;// Optional fingerprint slot ID
  deviceId?: string;    // Associated device
}

export interface CreateSessionDto {
  courseCode: string;
  topic: string;
  lecturerName: string;
  lecturerEmail?: string;
  lecturerId?: string;
  date: string;
  startTime: string;
  lateCutoff: string;
  endTime: string;
  deviceId: string;
}

export interface ToggleDeviceDto {
  deviceId: string;
  isEnabled: boolean;
}
