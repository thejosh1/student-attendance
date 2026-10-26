/*
  ====================================================================================
  W.O.R.C — Wireless Operations for Real-time Check-in (ESP32 FIRMWARE)
  Biometric Attendance Terminal & Dual-Mode WiFi Proximity OTP Edition
  ====================================================================================
  
  PROXIMITY OTP SPECIFICATION:
  - ESP32 Dual Mode: WIFI_AP_STA (Station for Cloud HTTPS + SoftAP for Local Proximity).
  - Bounded Distance: WiFi RF Transmit Power clamped to WIFI_POWER_8_5dBm (~7 mW).
    This restricts signal propagation to ~15-20 meters (approx 50 feet / classroom radius),
    preventing attendance verification from outside the lecture hall.
  - Zero-Connect SSID Beacon: Broadcasts SSID "WORC-OTP-[CODE]" (e.g., WORC-OTP-582914).
    Students can glance at their phone's WiFi network list to see the 6-digit OTP
    without disconnecting from mobile data!
  - Captive Proximity Portal: If students connect to the AP (192.168.4.1), the web server
    displays the live OTP, class name, and direct link to the attendance web app.
  - Rolling 60-second OTP synchronization with Vercel Cloud Server.
  - 16x2 I2C LCD live countdown and status display.

  HARDWARE SUBSYSTEM:
  - ESP32-WROOM-32 Microcontroller
  - AS608 / Optical Fingerprint Sensor (UART Serial2: RX2=Pin 16, TX2=Pin 17 @ 57600 baud)
  - DS3231 I2C Real Time Clock (SDA=Pin 21, SCL=Pin 22)
  - MicroSD Card Module (SPI: CS=Pin 5, MOSI=23, MISO=19, SCK=18)
  - 16x2 I2C LCD Display (Address 0x27)
  
  CLOUD INTEGRATION:
  - Synchronizes in real-time with Next.js/NestJS Vercel Cloud Server.
  - Device Identification (Multi-Device architecture: DEV-FUTO-01 to DEV-FUTO-04).
  - Handles Lecturer Device Enable/Disable controls (HTTP 403 enforcement).
  - Automatic Offline Fallback: logs locally to SD card if WiFi is down.
  - Auto-Sync: uploads cached offline logs when WiFi reconnects.
  ====================================================================================
*/

#include <SPI.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_Fingerprint.h>
#include <RTClib.h>
#include <WiFi.h>
#include <WebServer.h>
#include <SD.h>
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

/* ================= CONFIGURATION ================= */
// 1. WiFi Credentials for Internet Cloud Synchronization
const char* ssid = "CONRAD10";
const char* password = "ROBOTICS";

// 2. Cloud Server Endpoint (Live Vercel Production URL)
const char* vercelBaseUrl   = "https://student-attendance-peach.vercel.app";
const char* scanEndpoint     = "/api/biometric/scan";
const char* enrollEndpoint   = "/api/biometric/enroll";
const char* sessionEndpoint  = "/api/biometric/session";

// 3. Hardware Unit Identity (Physical terminal can host ANY course set by lecturer)
const char* DEVICE_ID = "DEV-FUTO-01";
const char* DEFAULT_COURSE = "TCE 511"; // Fallback default if no cloud session is active

// 4. WiFi Transmit Power & Proximity Setting (< 50 Feet / ~15-20 meters)
// Standard ESP32 power is WIFI_POWER_19_5dBm (up to 150-200m).
// Setting to WIFI_POWER_8_5dBm (~7mW) limits the beacon propagation
// to approximately 50 feet indoors, preventing remote attendance fraud.
#define WIFI_OTP_TX_POWER WIFI_POWER_8_5dBm

/* SD CARD SPI PINS */
#define SD_CS 5

/* OBJECTS */
LiquidCrystal_I2C lcd(0x27, 16, 2); 
HardwareSerial FingerSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&FingerSerial);
RTC_DS3231 rtc;
WebServer server(80);

/* STATE MACHINE ENUM */
enum SystemState {
  STATE_NORMAL,
  STATE_ENROLL_WAIT_1,
  STATE_ENROLL_WAIT_REMOVE,
  STATE_ENROLL_WAIT_2,
  STATE_SHOW_MSG
};

SystemState currentState = STATE_NORMAL;
unsigned long stateTimer = 0;
const unsigned long ENROLL_TIMEOUT = 15000;
const unsigned long MSG_TIMEOUT = 2500;

/* HARDWARE FLAGS */
bool hasRTC = false;
bool hasSD = false;
bool hasFinger = false;
bool hasLCD = false; // Set to true when I2C LCD is attached

/* ATTENDANCE & ENROLL CONTROL */
int lastID = -1;
unsigned long lastScan = 0;
int enrollID = -1;
String enrollName = "";
String enrollRegNo = "";
String enrollEmail = "";
String enrollCourse = "";

/* AUTHORITATIVE CLOUD SESSION & PROXIMITY OTP STATE */
// "active" (class ongoing), "ended" (ended within 30 min), "idle" (no class / standby)
String currentSessionStatus = "idle";
String currentSessionCourse = "";
String currentDisplayLine1  = "Scan Fingerprint";
String currentDisplayLine2  = "";
String currentSessionEndTime = "";
unsigned long lastSessionCheck = 0;

/* WIFI PROXIMITY OTP STATE */
String currentOtp = "100000";
int otpSecondsRemaining = 60;
unsigned long lastOtpTick = 0;
String currentApSsid = "WORC-DEV-FUTO-01";

/* FORWARD DECLARATIONS */
void checkFingerprintNormal();
void checkCloudEnrollmentCommand();
void checkCloudSessionStatus();
void syncOfflineLogsToServer();
void queueOfflineScan(int id, String timestamp);
void updateWifiBroadcast(String otp);
void handleRoot();
void handleDownload();
void handleClear();
void handleWipeSD();
void handleSyncNow();
void handleEnroll();
void handleGetLogs();
String getStudentName(int id);
int getNextAvailableID();
String parseJsonString(String json, String key);
int parseJsonInt(String json, String key);

/* ---------------- SCREEN DISPLAY HELPER ---------------- */

void showMessage(String line1, String line2)
{
  Serial.print("[SYSTEM] ");
  Serial.print(line1);
  Serial.print(" | ");
  Serial.println(line2);

  if (hasLCD) {
    lcd.clear();
    int pad1 = (16 - line1.length()) / 2;
    if (pad1 < 0) pad1 = 0; 
    lcd.setCursor(pad1, 0);
    lcd.print(line1);
    int pad2 = (16 - line2.length()) / 2;
    if (pad2 < 0) pad2 = 0;
    lcd.setCursor(pad2, 1);
    lcd.print(line2);
  }
}

void triggerMessageState(String line1, String line2) 
{
  showMessage(line1, line2);
  stateTimer = millis();
  currentState = STATE_SHOW_MSG;
}

void resetScreen()
{
  if (WiFi.status() == WL_CONNECTED) {
    if (currentSessionStatus == "active") {
      String l1 = currentDisplayLine1.length() > 0 ? currentDisplayLine1 : (currentSessionCourse + " [LIVE]");
      String l2;
      if (currentOtp.length() > 0 && currentOtp != "100000") {
        l2 = "OTP:" + currentOtp + " (" + String(otpSecondsRemaining) + "s)";
      } else {
        l2 = currentDisplayLine2.length() > 0 ? currentDisplayLine2 : "Place Finger";
      }
      showMessage(l1, l2);
    } else {
      // Standby screen
      showMessage("Scan Fingerprint", String(DEVICE_ID) + " [ONLINE]");
    }
  } else {
    showMessage("Scan Fingerprint", String(DEVICE_ID) + " [OFFLINE]");
  }
  currentState = STATE_NORMAL;
}

/* ---------------- WIFI PROXIMITY BROADCAST UPDATER ---------------- */

/**
 * Updates the SoftAP SSID dynamically based on active class and rolling OTP.
 * Ensures transmit power is clamped to 8.5 dBm (< 50 feet range).
 */
void updateWifiBroadcast(String otp)
{
  String targetSsid;
  if (currentSessionStatus == "active" && otp.length() > 0 && otp != "100000") {
    targetSsid = "WORC-OTP-" + otp;
  } else {
    targetSsid = "WORC-" + String(DEVICE_ID);
  }

  if (targetSsid != currentApSsid) {
    currentApSsid = targetSsid;
    // Broadcast open SoftAP on channel 1, hidden=false, max_connection=8
    WiFi.softAP(currentApSsid.c_str(), "", 1, 0, 8);
    WiFi.setTxPower(WIFI_OTP_TX_POWER); // Clamp to ~50 feet indoor radius
    Serial.printf("[WIFI BEACON] SoftAP SSID updated: %s (TX: 8.5dBm / <50ft radius)\n", currentApSsid.c_str());
  }
}

/* ---------------- TIME HELPER ---------------- */

String getFormattedTimestamp() {
  if (hasRTC) {
    DateTime now = rtc.now();
    char buf[25];
    sprintf(buf, "%04d-%02d-%02d %02d:%02d:%02d",
            now.year(), now.month(), now.day(),
            now.hour(), now.minute(), now.second());
    return String(buf);
  }
  return "2026-10-12 08:00:00";
}

/* ---------------- JSON PARSING HELPERS ---------------- */

String parseJsonString(String json, String key) {
  int k = json.indexOf("\"" + key + "\"");
  if (k < 0) return "";
  int colon = json.indexOf(':', k);
  if (colon < 0) return "";
  int q1 = json.indexOf('"', colon);
  if (q1 < 0) return "";
  int q2 = json.indexOf('"', q1 + 1);
  if (q2 < 0) return "";
  return json.substring(q1 + 1, q2);
}

int parseJsonInt(String json, String key) {
  int k = json.indexOf("\"" + key + "\"");
  if (k < 0) return 0;
  int colon = json.indexOf(':', k);
  if (colon < 0) return 0;
  int start = colon + 1;
  while (start < json.length() && (json.charAt(start) == ' ' || json.charAt(start) == '"')) start++;
  int end = start;
  while (end < json.length() && isDigit(json.charAt(end))) end++;
  return json.substring(start, end).toInt();
}

/* ---------------- CLOUD API SYNCHRONIZATION ---------------- */

/**
 * Sends biometric scan to Vercel API over HTTPS.
 * Server is the authoritative source for student identity and class validity.
 */
bool sendScanToCloud(int fingerId, String customTimestamp, String &outMessage, String &outStudentName, int &outHttpCode, bool isOffline = false) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[CLOUD] WiFi not connected. Cannot reach Server.");
    outMessage = "WiFi Disconnected";
    outStudentName = "";
    outHttpCode = -1;
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure(); // Allows connecting to HTTPS without bundling root certificates

  HTTPClient https;
  String fullUrl = String(vercelBaseUrl) + String(scanEndpoint);

  Serial.println("[CLOUD] POST -> " + fullUrl);

  if (https.begin(client, fullUrl)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("X-Device-Id", DEVICE_ID);
    https.setTimeout(7000);

    String ts = customTimestamp.length() > 0 ? customTimestamp : getFormattedTimestamp();

    // Build JSON payload with dynamic course assigned by lecturer
    String activeCourse = currentSessionCourse.length() > 0 ? currentSessionCourse : String(DEFAULT_COURSE);
    String payload = "{";
    payload += "\"deviceUserId\":\"" + String(fingerId) + "\",";
    payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
    payload += "\"classId\":\"" + activeCourse + "\",";
    payload += "\"timestamp\":\"" + ts + "\",";
    payload += "\"method\":\"fingerprint\"";
    if (isOffline) {
      payload += ",\"isOfflineSync\":true";
    }
    payload += "}";

    int httpCode = https.POST(payload);
    outHttpCode = httpCode;
    Serial.printf("[CLOUD] Response Code: %d\n", httpCode);

    if (httpCode > 0) {
      String response = https.getString();
      Serial.println("[CLOUD] Payload: " + response);

      // Extract actual student name registered on the SERVER
      outStudentName = parseJsonString(response, "student");

      if (httpCode == 200) {
        if (response.indexOf("duplicate") > 0) {
          outMessage = "Already Scanned";
        } else if (response.indexOf("check-out") > 0) {
          outMessage = "Checked Out";
        } else {
          String attStatus = parseJsonString(response, "attendanceStatus");
          if (attStatus == "late") {
            outMessage = "Late!";
          } else {
            outMessage = "Present!";
          }
        }
        https.end();
        return true;
      } else if (httpCode == 400) {
        if (response.indexOf("session-ended") > 0 || response.indexOf("CLASS HAS ENDED") > 0) {
          outMessage = "Class Ended";
        } else if (response.indexOf("wrong-class") > 0 || response.indexOf("CLASS MISMATCH") > 0) {
          outMessage = "Wrong Class!";
        } else if (response.indexOf("no-session") > 0 || response.indexOf("NO ACTIVE CLASS") > 0) {
          outMessage = "No Class Active";
        } else {
          outMessage = "Scan Rejected";
        }
        https.end();
        return false;
      } else if (httpCode == 403) {
        outMessage = "Device Disabled";
        https.end();
        return false;
      } else if (httpCode == 404) {
        outMessage = "Not Enrolled";
        https.end();
        return false;
      }
    } else {
      Serial.printf("[CLOUD] HTTPS failed, error: %s\n", https.errorToString(httpCode).c_str());
      outMessage = "Cloud Unreachable";
      outStudentName = "";
    }
    https.end();
  }
  return false;
}

// Backward-compatible wrapper
bool sendScanToCloud(int fingerId, String &outMessage) {
  String studentName = "";
  int code = 0;
  return sendScanToCloud(fingerId, "", outMessage, studentName, code, false);
}

/**
 * Syncs student enrollment to Vercel API over HTTPS
 */
bool sendEnrollToCloud(int fingerId, String name, String regNo, String email, String course = "") {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[CLOUD ENROLL] WiFi not connected. Cannot reach Server.");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient https;
  String fullUrl = String(vercelBaseUrl) + String(enrollEndpoint);

  Serial.println("[CLOUD ENROLL] POST -> " + fullUrl);

  if (https.begin(client, fullUrl)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("X-Device-Id", DEVICE_ID);
    https.setTimeout(6000);

    String regCourse = course.length() > 0 ? course : ((currentSessionCourse.length() > 0) ? currentSessionCourse : String(DEFAULT_COURSE));

    String payload = "{";
    payload += "\"deviceUserId\":\"" + String(fingerId) + "\",";
    payload += "\"name\":\"" + name + "\",";
    payload += "\"admissionNo\":\"" + regNo + "\",";
    payload += "\"email\":\"" + email + "\",";
    payload += "\"className\":\"" + regCourse + "\",";
    payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\"";
    payload += "}";

    int httpCode = https.POST(payload);
    Serial.printf("[CLOUD ENROLL] Response Code: %d\n", httpCode);
    if (httpCode >= 200 && httpCode < 300) {
      Serial.println("[CLOUD ENROLL] Student registered to cloud successfully!");
      https.end();
      return true;
    }
    https.end();
  }
  return false;
}

/* ---------------- CLOUD COMMAND POLLING (ENROLLMENT) ---------------- */
unsigned long lastCommandCheck = 0;

void checkCloudEnrollmentCommand()
{
  if (WiFi.status() != WL_CONNECTED || currentState != STATE_NORMAL) return;
  if (millis() - lastCommandCheck < 2500) return;
  lastCommandCheck = millis();

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;
  String url = String(vercelBaseUrl) + String(enrollEndpoint) + "?deviceId=" + String(DEVICE_ID);

  if (https.begin(client, url)) {
    https.setTimeout(3500);
    int httpCode = https.GET();
    if (httpCode == 200) {
      String payload = https.getString();
      if (payload.indexOf("\"hasPending\":true") > 0) {
        Serial.println("[CLOUD COMMAND] Real Enrollment Command Received: " + payload);
        int targetSlot = parseJsonInt(payload, "slotId");
        enrollID = targetSlot > 0 ? targetSlot : getNextAvailableID();
        enrollName = parseJsonString(payload, "name");
        enrollRegNo = parseJsonString(payload, "admissionNo");
        enrollEmail = parseJsonString(payload, "email");
        enrollCourse = parseJsonString(payload, "className");

        showMessage("Place Finger", enrollName);
        stateTimer = millis();
        currentState = STATE_ENROLL_WAIT_1;
      }
    }
    https.end();
  }
}

/* ---------------- CLOUD SESSION & OTP POLLING ---------------- */

/**
 * Checks cloud every 3.5s for authoritative session and rolling OTP:
 * - "active": Updates currentOtp, adjusts SoftAP SSID to WORC-OTP-[CODE],
 *             and displays OTP countdown on the LCD.
 * - "ended": Displays "Class Has Ended" and resets SSID to WORC-DEV-FUTO-01.
 * - "idle": Displays standby and resets SSID to WORC-DEV-FUTO-01.
 */
void checkCloudSessionStatus()
{
  if (WiFi.status() != WL_CONNECTED || currentState != STATE_NORMAL) return;
  if (millis() - lastSessionCheck < 3500) return;
  lastSessionCheck = millis();

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;
  String url = String(vercelBaseUrl) + String(sessionEndpoint) + "?deviceId=" + String(DEVICE_ID);

  if (https.begin(client, url)) {
    https.setTimeout(3500);
    int httpCode = https.GET();
    if (httpCode == 200) {
      String payload = https.getString();
      String newStatus = parseJsonString(payload, "status");
      String newCourse = parseJsonString(payload, "courseCode");
      String newLine1  = parseJsonString(payload, "displayLine1");
      String newLine2  = parseJsonString(payload, "displayLine2");
      String newEndTime = parseJsonString(payload, "endTime");
      String newOtp    = parseJsonString(payload, "otp");
      int newExpiresIn = parseJsonInt(payload, "otpExpiresIn");

      currentSessionEndTime = newEndTime;

      // Handle Rolling Proximity OTP
      if (newOtp.length() > 0 && newOtp != currentOtp) {
        currentOtp = newOtp;
        if (newExpiresIn > 0) otpSecondsRemaining = newExpiresIn;
        Serial.printf("[WIFI OTP] New 60s Attendance OTP: %s (Expires in %ds)\n", currentOtp.c_str(), otpSecondsRemaining);
        updateWifiBroadcast(currentOtp);
      } else if (newExpiresIn > 0) {
        otpSecondsRemaining = newExpiresIn;
      }

      if (newStatus.length() > 0) {
        bool changed = (newStatus != currentSessionStatus || newCourse != currentSessionCourse);
        currentSessionStatus = newStatus;
        currentSessionCourse = newCourse;
        currentDisplayLine1  = newLine1;
        currentDisplayLine2  = newLine2;

        if (newStatus != "active") {
          updateWifiBroadcast("");
        }

        if (changed && currentState == STATE_NORMAL) {
          Serial.printf("[SESSION SYNC] State: %s | Course: %s | OTP: %s | EndTime: %s\n",
                        currentSessionStatus.c_str(), currentSessionCourse.c_str(),
                        currentOtp.c_str(), currentSessionEndTime.c_str());
          resetScreen();
        }
      }
    }
    https.end();
  }
}

/* ---------------- SETUP & HW CHECKS ---------------- */

void setup()
{
  Serial.begin(115200);

  /* LCD INIT (if connected) */
  Wire.begin(21, 22);
  byte error;
  Wire.beginTransmission(0x27);
  error = Wire.endTransmission();
  if (error == 0) {
    hasLCD = true;
    lcd.init();
    lcd.backlight();
    Serial.println("[HW] I2C LCD detected at 0x27");
  } else {
    hasLCD = false;
    Serial.println("[HW] LCD not detected. Running serial mode.");
  }

  showMessage("W.O.R.C Terminal", "System Booting...");
  delay(1000); 

  /* HARDWARE CHECK 1: RTC DS3231 */
  if (!rtc.begin()) {
    showMessage("HW WARNING:", "RTC Missing");
    hasRTC = false;
  } else {
    hasRTC = true;
    Serial.println("[HW] RTC DS3231 Online");
  }

  /* HARDWARE CHECK 2: SD CARD */
  if (!SD.begin(SD_CS)) {
    showMessage("HW WARNING:", "SD Card Failed");
    hasSD = false;
  } else {
    hasSD = true;
    Serial.println("[HW] SD Card Mounted");
    if (!SD.exists("/logs.csv")) {
      File file = SD.open("/logs.csv", FILE_WRITE);
      file.println("ID,Name,Timestamp,DeviceID,Status");
      file.close();
    }
    if (SD.exists("/students.csv")) {
      SD.remove("/students.csv");
    }
  }

  /* HARDWARE CHECK 3: AS608 FINGERPRINT SENSOR */
  FingerSerial.begin(57600, SERIAL_8N1, 16, 17);
  if (!finger.verifyPassword()) {
    showMessage("HW WARNING:", "Sensor Missing");
    hasFinger = false;
    Serial.println("[HW] AS608 Sensor not found! Check RX2/TX2 pins 16 & 17.");
  } else {
    hasFinger = true;
    Serial.println("[HW] AS608 Optical Sensor Verified!");
    finger.getParameters();
  }

  /* DUAL-MODE WIFI & PROXIMITY BEACON SETUP */
  showMessage("Init Dual WiFi", "<50ft Proximity");
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);

  // Set initial TX Power to 8.5 dBm (~50 feet radius)
  WiFi.setTxPower(WIFI_OTP_TX_POWER);

  // Start Open Proximity SoftAP
  currentApSsid = "WORC-" + String(DEVICE_ID);
  WiFi.softAP(currentApSsid.c_str(), "", 1, 0, 8);
  Serial.printf("[WIFI BEACON] Proximity AP started: %s (IP: %s, TX: 8.5dBm / ~50ft)\n",
                currentApSsid.c_str(), WiFi.softAPIP().toString().c_str());

  // Connect Station mode to campus/router WiFi for Cloud Sync
  WiFi.begin(ssid, password);
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected! Station IP: " + WiFi.localIP().toString());
    if (MDNS.begin("attendance")) {
      Serial.println("[MDNS] Responder started as attendance.local");
    }
    showMessage("WiFi Online", WiFi.localIP().toString());
  } else {
    Serial.println("\n[WIFI] Station Failed - Running in Offline SD Mode");
    showMessage("Station Offline", "SD Fallback");
  }
  delay(1500);

  /* LOCAL WEB SERVER ROUTES */
  server.on("/", handleRoot);
  server.on("/download", handleDownload);
  server.on("/clear", handleClear);
  server.on("/wipe-sd", handleWipeSD);
  server.on("/sync", handleSyncNow);
  server.on("/enroll", handleEnroll);
  server.on("/getLogs", handleGetLogs);
  server.begin();

  resetScreen();
}

/* ---------------- NON-BLOCKING MAIN LOOP ---------------- */

void loop()
{
  server.handleClient();

  // Handle LCD OTP countdown live update every second
  if (currentSessionStatus == "active" && currentState == STATE_NORMAL) {
    if (millis() - lastOtpTick >= 1000) {
      lastOtpTick = millis();
      if (otpSecondsRemaining > 1) {
        otpSecondsRemaining--;
      } else {
        otpSecondsRemaining = 60;
      }
      if (hasLCD && currentOtp.length() > 0 && currentOtp != "100000") {
        lcd.setCursor(0, 1);
        char buf[17];
        snprintf(buf, sizeof(buf), "OTP:%-6s (%2ds)", currentOtp.c_str(), otpSecondsRemaining);
        lcd.print(buf);
      }
    }
  }

  switch (currentState) 
  {
    case STATE_NORMAL:
      if (hasFinger) checkFingerprintNormal();
      checkCloudEnrollmentCommand();
      checkCloudSessionStatus();
      syncOfflineLogsToServer();
      break;

    case STATE_ENROLL_WAIT_1:
      if (!hasFinger) {
        triggerMessageState("ERROR", "No Sensor");
        break;
      }
      if (millis() - stateTimer > ENROLL_TIMEOUT) {
        triggerMessageState("TIMEOUT", "Try Again");
      } else if (finger.getImage() == FINGERPRINT_OK) {
        finger.image2Tz(1);
        showMessage("Remove Finger", "Wait...");
        stateTimer = millis();
        currentState = STATE_ENROLL_WAIT_REMOVE;
      }
      break;

    case STATE_ENROLL_WAIT_REMOVE:
      if (finger.getImage() == FINGERPRINT_NOFINGER) {
        showMessage("Place Again", "Confirm Finger");
        stateTimer = millis();
        currentState = STATE_ENROLL_WAIT_2;
      }
      break;

    case STATE_ENROLL_WAIT_2:
      if (millis() - stateTimer > ENROLL_TIMEOUT) {
        triggerMessageState("TIMEOUT", "Try Again");
      } else if (finger.getImage() == FINGERPRINT_OK) {
        finger.image2Tz(2);
        
        if (finger.createModel() == FINGERPRINT_OK && finger.storeModel(enrollID) == FINGERPRINT_OK) {
          sendEnrollToCloud(enrollID, enrollName, enrollRegNo, enrollEmail, enrollCourse);
          triggerMessageState("ENROLLED!", enrollName);
        } else {
          triggerMessageState("FAILED", "Could Not Save");
        }
      }
      break;

    case STATE_SHOW_MSG:
      if (millis() - stateTimer > MSG_TIMEOUT) {
        resetScreen();
      }
      break;
  }
}

/* ---------------- NORMAL SCAN LOGIC ---------------- */

void checkFingerprintNormal()
{
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK) return;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return;

  p = finger.fingerFastSearch();

  if (p == FINGERPRINT_OK) {
    int id = finger.fingerID;

    if (id == lastID && millis() - lastScan < 10000) {
      triggerMessageState("Already Scanned", "Wait 10s");
      return;
    }

    lastID = id;
    lastScan = millis();

    Serial.printf("[SCAN] Finger Match Found on Optical Sensor! Template Slot: %d\n", id);

    if (WiFi.status() == WL_CONNECTED) {
      String outMessage = "";
      String serverStudentName = "";
      int httpCode = 0;
      bool cloudSuccess = sendScanToCloud(id, "", outMessage, serverStudentName, httpCode, false);

      if (cloudSuccess) {
        String displayName = serverStudentName.length() > 0 ? serverStudentName : "Student #" + String(id);
        Serial.printf("[SCAN] Verified by Server: %s -> %s\n", displayName.c_str(), outMessage.c_str());
        triggerMessageState(displayName, outMessage);
      } else {
        if (httpCode == 404) {
          triggerMessageState("ACCESS REJECTED", "Not Enrolled");
        } else if (httpCode == 403) {
          triggerMessageState("ACCESS BLOCKED", "Device Disabled");
        } else if (httpCode == 400) {
          if (outMessage == "Class Ended") {
            String courseLabel = currentSessionCourse.length() > 0 ? currentSessionCourse : "Class Ended";
            triggerMessageState(courseLabel, "Class Has Ended");
          } else if (outMessage == "No Class Active") {
            triggerMessageState("No Active Class", "Scan Rejected");
          } else {
            String displayHeader = serverStudentName.length() > 0 ? serverStudentName : "ACCESS REJECTED";
            triggerMessageState(displayHeader, outMessage);
          }
        } else {
          queueOfflineScan(id, getFormattedTimestamp());
          triggerMessageState("Offline Cached", "Slot #" + String(id));
        }
      }
    } else {
      queueOfflineScan(id, getFormattedTimestamp());
      triggerMessageState("Saved Offline", "Slot #" + String(id));
    }
  } else {
    triggerMessageState("ACCESS DENIED", "Not Recognized");
  }
}

/* ---------------- OFFLINE STORAGE & AUTO-SYNC ---------------- */

void queueOfflineScan(int id, String timestamp)
{
  if (!hasSD) return;
  File file = SD.open("/offline_queue.csv", FILE_APPEND);
  if (file) {
    file.print(id);
    file.print(",");
    file.print(timestamp);
    file.print(",");
    file.print(DEVICE_ID);
    file.print(",");
    String activeCourse = currentSessionCourse.length() > 0 ? currentSessionCourse : String(DEFAULT_COURSE);
    file.println(activeCourse);
    file.close();
  }
}

unsigned long lastSyncCheck = 0;

void syncOfflineLogsToServer()
{
  if (WiFi.status() != WL_CONNECTED || !hasSD || currentState != STATE_NORMAL) return;
  if (millis() - lastSyncCheck < 10000) return;
  lastSyncCheck = millis();

  if (!SD.exists("/offline_queue.csv")) return;

  File file = SD.open("/offline_queue.csv", FILE_READ);
  if (!file) return;

  if (file.size() == 0) {
    file.close();
    SD.remove("/offline_queue.csv");
    return;
  }

  String lines[50];
  int count = 0;
  while (file.available() && count < 50) {
    String l = file.readStringUntil('\n');
    l.trim();
    if (l.length() > 0) lines[count++] = l;
  }
  file.close();

  if (count == 0) {
    SD.remove("/offline_queue.csv");
    return;
  }

  int successCount = 0;
  for (int i = 0; i < count; i++) {
    String l = lines[i];
    int c1 = l.indexOf(',');
    if (c1 < 0) continue;
    int c2 = l.indexOf(',', c1 + 1);
    if (c2 < 0) continue;

    int slotId = l.substring(0, c1).toInt();
    String ts = l.substring(c1 + 1, c2);

    String outMsg = "";
    String serverName = "";
    int code = 0;
    bool ok = sendScanToCloud(slotId, ts, outMsg, serverName, code, true);

    if (ok || code == 200 || code == 400) {
      successCount++;
    } else {
      return;
    }
    delay(200);
  }

  SD.remove("/offline_queue.csv");
  triggerMessageState("SD Synced", String(successCount) + " Logs Wiped");
}

/* ---------------- DATA HELPERS ---------------- */

String getStudentName(int id)
{
  if (!hasSD) return "Student-" + String(id);
  File file = SD.open("/students.csv");
  if (!file) return "Student-" + String(id);

  while (file.available()) {
    String line = file.readStringUntil('\n');
    int comma1 = line.indexOf(',');
    if (comma1 > 0) {
      int fileID = line.substring(0, comma1).toInt();
      if (fileID == id) {
        int comma2 = line.indexOf(',', comma1 + 1);
        String name = (comma2 > comma1) ? line.substring(comma1 + 1, comma2) : line.substring(comma1 + 1);
        name.trim();
        file.close();
        return name;
      }
    }
  }
  file.close();
  return "Student-" + String(id);
}

int getNextAvailableID()
{
  if (!hasSD) return 1;
  File file = SD.open("/students.csv", FILE_READ);
  if (!file) return 1;

  int maxID = 0;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    int comma = line.indexOf(',');
    if (comma > 0) {
      int id = line.substring(0, comma).toInt();
      if (id > maxID) maxID = id;
    }
  }
  file.close();
  return maxID + 1;
}

/* ---------------- LOCAL WEB ROUTES (CAPTIVE / DIAGNOSTICS) ---------------- */

void handleRoot()
{
  String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>W.O.R.C Proximity Terminal - " + String(DEVICE_ID) + "</title>";
  html += "<style>body{font-family:Arial,sans-serif;background:#0f172a;color:#f8fafc;margin:0;padding:20px;text-align:center;}";
  html += ".card{max-width:540px;margin:20px auto;background:#1e293b;padding:24px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.5);border:1px solid #334155;}";
  html += ".badge{padding:4px 10px;border-radius:999px;font-size:11px;font-weight:bold;background:#059669;color:white;display:inline-block;}";
  html += ".otp-box{font-size:42px;font-weight:900;letter-spacing:8px;color:#38bdf8;background:#0f172a;padding:16px;border-radius:12px;margin:20px 0;border:2px dashed #0284c7;}";
  html += ".btn{padding:12px 20px;background:#0284c7;color:white;text-decoration:none;border-radius:10px;display:inline-block;font-weight:bold;margin:8px 4px;}";
  html += ".btn-danger{background:#dc2626;}";
  html += ".btn-slate{background:#475569;}";
  html += "</style></head><body><div class='card'>";

  html += "<div class='badge'>W.O.R.C PROXIMITY TERMINAL &lt; 50 FEET</div>";
  html += "<h2 style='margin-top:12px;margin-bottom:4px;'>Classroom Proximity Confirmed</h2>";
  html += "<p style='color:#94a3b8;font-size:13px;margin-top:0;'>Terminal: <b>" + String(DEVICE_ID) + "</b> | Range: <b>&lt; 50 Feet (Classroom Zone)</b></p>";

  if (currentSessionStatus == "active") {
    html += "<p style='margin-top:16px;font-size:14px;'>Active Course: <b style='color:#38bdf8;'>" + currentSessionCourse + "</b></p>";
    html += "<div class='otp-box'>" + currentOtp + "</div>";
    html += "<p style='color:#cbd5e1;font-size:12px;'>Expires in ~" + String(otpSecondsRemaining) + "s (Rolling Code)</p>";
    html += "<a class='btn' href='" + String(vercelBaseUrl) + "/checkin' target='_blank'>Submit Attendance on Website</a>";
  } else {
    html += "<div style='padding:20px 0;color:#94a3b8;'>No active lecture session scheduled right now.<br>Standby for Lecturer activation.</div>";
    html += "<a class='btn btn-slate' href='" + String(vercelBaseUrl) + "' target='_blank'>Go to Dashboard</a>";
  }

  html += "<hr style='border:none;border-top:1px solid #334155;margin:24px 0 16px 0;'>";
  html += "<h4 style='color:#94a3b8;margin-bottom:8px;'>Terminal Diagnostics</h4>";
  html += "<a class='btn btn-slate' href='/sync'>Push Offline Logs</a>";
  html += "<a class='btn btn-slate' href='/download'>Download SD CSV</a>";
  html += "<a class='btn btn-danger' href='/wipe-sd' onclick=\"return confirm('Wipe SD cache?')\">Wipe SD</a>";
  html += "</div></body></html>";
  server.send(200, "text/html", html);
}

void handleSyncNow()
{
  lastSyncCheck = 0;
  syncOfflineLogsToServer();
  server.send(200, "text/html", "<html><body style='font-family:Arial;padding:20px;'><h2>Offline Sync Triggered!</h2><p>Check the serial monitor or LCD screen. Pending records pushed.</p><a href='/'>Back to Terminal</a></body></html>");
}

void handleWipeSD()
{
  if (hasSD) {
    SD.remove("/logs.csv");
    SD.remove("/students.csv");
    SD.remove("/offline_queue.csv");
  }
  showMessage("SD Buffer Wiped", "Clean State");
  server.send(200, "text/html", "<html><body style='font-family:Arial;padding:20px;'><h2>SD Card Memory Wiped Clean!</h2><a href='/'>Back to Terminal</a></body></html>");
}

void handleGetLogs()
{
  if (!hasSD) { server.send(200, "text/html", "<tr><td colspan='4'>SD Error</td></tr>"); return; }
  File file = SD.open("/logs.csv");
  if (!file) { server.send(200, "text/html", "<tr><td colspan='4'>No logs</td></tr>"); return; }
  server.setContentLength(CONTENT_LENGTH_UNKNOWN);
  server.send(200, "text/html", "");

  bool isFirstLine = true;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (isFirstLine) { isFirstLine = false; continue; }
    server.sendContent("<tr><td>" + line + "</td></tr>");
  }
  file.close();
  server.sendContent(""); 
}

void handleDownload()
{
  if (!hasSD) { server.send(500, "text/plain", "SD Missing"); return; }
  File file = SD.open("/logs.csv");
  if (!file) { server.send(404, "text/plain", "File not found"); return; }
  server.streamFile(file, "text/csv");
  file.close();
}

void handleClear()
{
  if (hasFinger) finger.emptyDatabase();
  if (hasSD) {
    SD.remove("/logs.csv");
    SD.remove("/students.csv");
    SD.remove("/offline_queue.csv");
    File file = SD.open("/logs.csv", FILE_WRITE);
    file.println("ID,Name,Timestamp,DeviceID,Status");
    file.close();
  }
  showMessage("Sensor Wiped", "Clean Slate");
  server.send(200, "text/html", "<html><body style='font-family:Arial;padding:20px;'><h2>Terminal Reset!</h2><a href='/'>Back</a></body></html>");
}

void handleEnroll()
{
  if (!server.hasArg("name")) { server.send(400, "text/plain", "Missing Name"); return; }
  enrollName = server.arg("name");
  enrollRegNo = server.hasArg("regNo") ? server.arg("regNo") : "FUTO-REG";
  enrollEmail = server.hasArg("email") ? server.arg("email") : "student@futo.edu.ng";

  int requestedSlot = server.hasArg("slot") ? server.arg("slot").toInt() : 0;
  enrollID = requestedSlot > 0 ? requestedSlot : getNextAvailableID();

  showMessage("Place Finger", enrollName);
  stateTimer = millis();
  currentState = STATE_ENROLL_WAIT_1;
  server.send(200, "text/html", "Enrolling " + enrollName + " as ID: " + String(enrollID) + "<br><a href='/'>Back</a>");
}
