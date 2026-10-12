export interface ScanAttendanceDto {
  deviceUserId: string; // The fingerprint slot ID (e.g., 2001, 1, 2)
  deviceId: string;     // The hardware device unit (e.g., DEV-FUTO-01)
  method?: "fingerprint";
  timestamp?: string;   // ISO timestamp
  classId?: string;     // e.g. COE 505
}

export interface EnrollStudentDto {
  name: string;
  admissionNo: string;  // Matric / Reg No (e.g. 2020/121870)
  email: string;
  className: string;    // Course (e.g. COE 505)
  deviceUserId?: string;// Optional fingerprint slot ID
  deviceId?: string;    // Associated device
}

export interface CreateSessionDto {
  courseCode: string;
  topic: string;
  lecturerName: string;
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
