# ESP32 Biometric Terminal Hardware Setup Guide
## W.O.R.C — Wireless Operations for Real-time Check-in

This guide is for the hardware engineer configuring and flashing the ESP32 microcontroller units to connect with the cloud platform.

---

## 1. Hardware Bill of Materials (BOM)

| Component | Description | Recommended Specs |
| :--- | :--- | :--- |
| **Microcontroller** | ESP32-WROOM-32 Development Board | 38-pin or 30-pin, Dual Core 240MHz, 4MB Flash |
| **Fingerprint Sensor** | AS608 / FPM10A Optical Biometric Sensor | UART 57600 baud, 500 DPI, 3.3V/5V logic |
| **RTC Clock** | DS3231 High-Precision I2C Real Time Clock | CR2032 backup battery, I2C address 0x68 |
| **Display** | 16x2 Character LCD with I2C Backpack | PCF8574 I2C adapter, default address 0x27 |
| **SD Storage** | MicroSD Card SPI Module | Standard SPI card reader, FAT32 formatted card |
| **Power Supply** | 5V 2A DC Adapter or 3.7V 18650 Li-ion battery | Step-up boost / AMS1117 3.3V regulator |

---

## 2. Complete Wiring Pinout

### A. AS608 Optical Fingerprint Sensor to ESP32
> **Note**: Pin 16 and 17 on the ESP32 correspond to `HardwareSerial(2)`.
- **Sensor VCC (Red)** ➔ ESP32 **5V** (or 3.3V depending on module version)
- **Sensor GND (Black)** ➔ ESP32 **GND**
- **Sensor TX (Green / Yellow)** ➔ ESP32 **GPIO 16 (RX2)**
- **Sensor RX (White / Green)** ➔ ESP32 **GPIO 17 (TX2)**

### B. DS3231 Real-Time Clock & 16x2 I2C LCD (Shared I2C Bus)
- **RTC & LCD VCC** ➔ ESP32 **5V** (or VIN)
- **RTC & LCD GND** ➔ ESP32 **GND**
- **RTC & LCD SDA** ➔ ESP32 **GPIO 21 (SDA)**
- **RTC & LCD SCL** ➔ ESP32 **GPIO 22 (SCL)**

### C. MicroSD Card Reader (SPI Bus)
- **SD CS** ➔ ESP32 **GPIO 5**
- **SD MOSI** ➔ ESP32 **GPIO 23**
- **SD MISO** ➔ ESP32 **GPIO 19**
- **SD SCK / CLK** ➔ ESP32 **GPIO 18**
- **SD VCC** ➔ ESP32 **5V**
- **SD GND** ➔ ESP32 **GND**

---

## 3. Required Arduino IDE Libraries

Install these libraries via **Tools > Manage Libraries...** in Arduino IDE:
1. `Adafruit Fingerprint Sensor Library` (by Adafruit)
2. `RTClib` (by Adafruit)
3. `LiquidCrystal I2C` (by Frank de Brabander or Marco Schwartz)
4. `SD` and `SPI` (Built into ESP32 Arduino Board Package)
5. `WiFiClientSecure` and `HTTPClient` (Built into ESP32 Arduino Board Package)

---

## 4. Firmware Configuration (Before Flashing)

Open `futo_attendance_esp32/futo_attendance_esp32.ino` and configure lines 36–50:

### A. WiFi Settings
```cpp
const char* ssid     = "YOUR_CAMPUS_OR_PHONE_HOTSPOT";
const char* password = "YOUR_PASSWORD";
```

### B. Vercel Cloud Server URL
Replace `https://your-futo-attendance.vercel.app` with your actual Vercel domain:
```cpp
const char* vercelBaseUrl = "https://your-production-app.vercel.app";
```

### C. Hardware Node ID (Deploying to Multiple Classrooms)
The cloud system has 4 configured terminals:
- Unit 1 (Hall A / TCE 502):
  ```cpp
  const char* DEVICE_ID = "DEV-FUTO-01";
  const char* ASSIGNED_COURSE = "TCE 502";
  ```
- Unit 2 (Telecom Lab 3 / TCE 311):
  ```cpp
  const char* DEVICE_ID = "DEV-FUTO-02";
  const char* ASSIGNED_COURSE = "TCE 311";
  ```
- Unit 3 (RF & Microwave Lab / TCE 411):
  ```cpp
  const char* DEVICE_ID = "DEV-FUTO-03";
  const char* ASSIGNED_COURSE = "TCE 411";
  ```
- Unit 4 (Auditorium / TCE 506):
  ```cpp
  const char* DEVICE_ID = "DEV-FUTO-04";
  const char* ASSIGNED_COURSE = "TCE 506";
  ```

> **Security Rule**: The platform starts with **DEV-FUTO-01 enabled** and **DEV-FUTO-02, 03, 04 disabled**. When a disabled device sends a scan, the cloud server responds with HTTP 403, and the device LCD will display: `ACCESS BLOCKED: Device Disabled`. Lecturers can enable/disable any device anytime from the web dashboard under **/devices**.

---

## 5. Flashing Instructions

1. Connect the ESP32 to your PC via micro-USB.
2. In Arduino IDE:
   - **Board**: `ESP32 Dev Module`
   - **Flash Frequency**: `80MHz`
   - **Upload Speed**: `921600` (or `115200` if upload fails)
   - **Port**: Select your COM port (e.g. `COM3` on Windows, `/dev/ttyUSB0` on Linux/Mac)
3. Click **Upload**.
4. Open **Serial Monitor** at **115200 baud**.
5. Expected Startup Log:
   ```text
   [SYSTEM] FUTO Biometrics | System Booting...
   [HW] I2C LCD detected at 0x27
   [HW] RTC DS3231 Online
   [HW] SD Card Mounted
   [HW] AS608 Optical Sensor Verified!
   [HW] Capacity: 300 templates | Security Level: 3
   [WIFI] Connected! IP: 192.168.1.101
   [MDNS] Responder started as attendance.local
   [SYSTEM] Scan Fingerprint | DEV-FUTO-01 [ONLINE]
   ```

---

## 6. How Fingerprint Matching & Cloud Sync Operates

1. Student places finger on AS608 optical sensor.
2. Sensor extracts minutiae features and searches stored templates (`finger.fingerFastSearch()`).
3. If matched (e.g., slot ID #2001):
   - ESP32 builds JSON payload:
     `{"deviceUserId":"2001", "deviceId":"DEV-FUTO-01", "classId":"TCE 502", "timestamp":"2026-10-12 08:05:00"}`
   - Makes HTTPS POST to `/api/biometric/scan`.
   - **HTTP 200 OK**: LCD displays student name + `Verified!`.
   - **HTTP 403 Forbidden**: LCD displays `ACCESS BLOCKED: Device Disabled`.
   - **No WiFi / Server Error**: LCD displays `Saved Offline` and writes entry to MicroSD card `/logs.csv`.
