import { CreateSessionDto, EnrollStudentDto, ScanAttendanceDto, ToggleDeviceDto } from "../dto/attendance.dto";
import { biometricService } from "../services/biometric.service";
import { deviceService } from "../services/device.service";
import { sessionService } from "../services/session.service";

/**
 * BiometricController represents the NestJS controller routing and handling requests
 */
export class BiometricController {
  async scanFingerprint(dto: ScanAttendanceDto) {
    return await biometricService.processScan(dto);
  }

  async enrollStudent(dto: EnrollStudentDto) {
    return await biometricService.enrollStudent(dto);
  }

  async getAttendance(date?: string, classFilter?: string) {
    return await biometricService.getDashboardAttendance(date, classFilter);
  }

  async getDevices() {
    return await deviceService.getDevices();
  }

  async toggleDevice(dto: ToggleDeviceDto) {
    return await deviceService.setDeviceEnabled(dto.deviceId, dto.isEnabled);
  }

  async getSessions() {
    return await sessionService.getSessions();
  }

  async createSession(dto: CreateSessionDto) {
    return await sessionService.createSession(dto);
  }

  async toggleSession(sessionId: string, action?: "end" | "activate" | "toggle") {
    return await sessionService.toggleSession(sessionId, action);
  }

  async endSession(sessionId: string) {
    return await sessionService.endSession(sessionId);
  }

  async getDeviceSessionStatus(deviceId: string) {
    return await sessionService.getDeviceSessionStatus(deviceId);
  }

  async deleteSession(sessionId: string) {
    return await sessionService.deleteSession(sessionId);
  }

  async deduplicateSessions() {
    return await sessionService.deduplicateSessions();
  }
}

export const biometricController = new BiometricController();
