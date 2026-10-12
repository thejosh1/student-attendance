import { BiometricDevice } from "@/lib/data";
import { getAllDevices, updateDeviceStatus } from "@/lib/store";

export class DeviceService {
  async getDevices(): Promise<BiometricDevice[]> {
    return await getAllDevices();
  }

  async setDeviceEnabled(deviceId: string, isEnabled: boolean) {
    const updated = await updateDeviceStatus(deviceId, isEnabled);
    if (!updated) {
      return { error: `Device ${deviceId} not found`, status: 404 };
    }
    return {
      success: true,
      device: updated,
      message: `Device ${deviceId} is now ${isEnabled ? "ENABLED (Online)" : "DISABLED"}.`,
    };
  }
}

export const deviceService = new DeviceService();
