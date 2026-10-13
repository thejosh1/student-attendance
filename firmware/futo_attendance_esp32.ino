/*
  ====================================================================================
  W.O.R.C — Wireless Operations for Real-time Check-in (ESP32 FIRMWARE)
  Biometric Attendance Terminal & Cloud Synchronization Edition
  ====================================================================================
  
  HARDWARE:
  - ESP32-WROOM-32 Microcontroller
  - AS608 / Optical Fingerprint Sensor (UART Serial2: RX2=Pin 16, TX2=Pin 17 @ 57600 baud)
  - DS3231 I2C Real Time Clock (SDA=Pin 21, SCL=Pin 22)
  - MicroSD Card Module (SPI: CS=Pin 5, MOSI=23, MISO=19, SCK=18)
  - 16x2 I2C LCD Display (Address 0x27)
  
  CLOUD INTEGRATION:
  - Synchronizes in real-time with Next.js/NestJS Vercel Cloud Server.
  - Device Identification (Multi-Device architecture: DEV-FUTO-01 to DEV-FUTO-04).
  - Handles Lecturer Device Enable/Disable controls.
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
// 1. WiFi Credentials
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

/* AUTHORITATIVE CLOUD SESSION STATE */
// "active" (class ongoing), "ended" (ended within 30 min), "idle" (no class / standby)
String currentSessionStatus = "idle";
String currentSessionCourse = "";
String currentDisplayLine1  = "Scan Fingerprint";
String currentDisplayLine2  = "";
String currentSessionEndTime = "";
unsigned long lastSessionCheck = 0;

/* FORWARD DECLARATIONS */
void checkFingerprintNormal();
void checkCloudEnrollmentCommand();
void checkCloudSessionStatus();
void syncOfflineLogsToServer();
void queueOfflineScan(int id, String timestamp);
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
      String l2 = currentDisplayLine2.length() > 0 ? currentDisplayLine2 : "Place Finger";
      showMessage(l1, l2);
    } else {
      // Clean standby screen - "Class Has Ended" will only show temporarily when someone scans an ended class
      showMessage("Scan Fingerprint", String(DEVICE_ID) + " [ONLINE]");
    }
  } else {
    showMessage("Scan Fingerprint", String(DEVICE_ID) + " [OFFLINE]");
  }
  currentState = STATE_NORMAL;
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

      // CRITICAL: Extract actual student name registered on the SERVER
      outStudentName = parseJsonString(response, "student");

      if (httpCode == 200) {
        // Success (Check-in, Check-out, or Duplicate)
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

/* ---------------- CLOUD COMMAND POLLING (FOR REAL HARDWARE ENROLLMENT) ---------------- */
unsigned long lastCommandCheck = 0;

/**
 * Checks cloud every 2.5s for pending student enrollment commands
 */
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

/* ---------------- CLOUD SESSION POLLING ---------------- */

/**
 * Checks cloud every 3.5s for authoritative class session state:
 * - "active": Class is live, displays class name and "Place Finger"
 * - "ended": Class ended within last 30 minutes, displays class name and "Class Has Ended"
 * - "idle": No class active or 30 mins elapsed, displays standby
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
      currentSessionEndTime = newEndTime;

      if (newStatus.length() > 0) {
        bool changed = (newStatus != currentSessionStatus || newCourse != currentSessionCourse);
        currentSessionStatus = newStatus;
        currentSessionCourse = newCourse;
        currentDisplayLine1  = newLine1;
        currentDisplayLine2  = newLine2;

        if (changed && currentState == STATE_NORMAL) {
          Serial.printf("[SESSION SYNC] State: %s | Course: %s | Screen: %s / %s | EndTime: %s\n",
                        currentSessionStatus.c_str(), currentSessionCourse.c_str(),
                        currentDisplayLine1.c_str(), currentDisplayLine2.c_str(),
                        currentSessionEndTime.c_str());
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
  byte error, address;
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
    // Prevent data conflicts: wipe any legacy local students.csv so server remains authoritative
    if (SD.exists("/students.csv")) {
      Serial.println("[SD] Purged legacy /students.csv to ensure cloud database authority.");
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
    Serial.printf("[HW] Capacity: %d templates | Security Level: %d\n", finger.capacity, finger.security_level);
  }

  /* WIFI & CLOUD CONNECTION */
  showMessage("Connecting WiFi", ssid);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.disconnect(true);
  delay(500);

  WiFi.begin(ssid, password);
  
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected! IP: " + WiFi.localIP().toString());
    if (MDNS.begin("attendance")) {
      Serial.println("[MDNS] Responder started as attendance.local");
    }
    showMessage("WiFi Connected", WiFi.localIP().toString());
  } else {
    Serial.println("\n[WIFI] Failed - Running in Offline SD Mode");
    showMessage("WiFi Failed", "Offline Mode");
  }
  delay(1500);

  /* LOCAL WEB SERVER ROUTES (For backup diagnostic & local access) */
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
          // Cloud Server is authoritative: sync enrollment directly to database (no local SD conflict)
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

    // CRITICAL ARCHITECTURE RULE:
    // What is stored on the SERVER is what the processor checks, NOT the SD card!
    // The SD card is strictly for offline fallback storage.
    if (WiFi.status() == WL_CONNECTED) {
      String outMessage = "";
      String serverStudentName = "";
      int httpCode = 0;
      bool cloudSuccess = sendScanToCloud(id, "", outMessage, serverStudentName, httpCode, false);

      if (cloudSuccess) {
        // ALWAYS display the student name stored on the SERVER!
        String displayName = serverStudentName.length() > 0 ? serverStudentName : "Student #" + String(id);
        Serial.printf("[SCAN] Verified by Server: %s -> %s\n", displayName.c_str(), outMessage.c_str());
        triggerMessageState(displayName, outMessage);
      } else {
        if (httpCode == 404) {
          Serial.printf("[SCAN] Slot #%d rejected by server: Template not enrolled in server database.\n", id);
          triggerMessageState("ACCESS REJECTED", "Not Enrolled");
        } else if (httpCode == 403) {
          Serial.println("[SCAN] Rejected by server: Terminal node is disabled by lecturer.");
          triggerMessageState("ACCESS BLOCKED", "Device Disabled");
        } else if (httpCode == 400) {
          if (outMessage == "Class Ended") {
            String courseLabel = currentSessionCourse.length() > 0 ? currentSessionCourse : "Class Ended";
            triggerMessageState(courseLabel, "Class Has Ended");
          } else if (outMessage == "No Class Active") {
            triggerMessageState("No Active Class", "Scan Rejected");
          } else {
            String displayHeader = serverStudentName.length() > 0 ? serverStudentName : "ACCESS REJECTED";
            Serial.printf("[SCAN] Server rejected scan: %s\n", outMessage.c_str());
            triggerMessageState(displayHeader, outMessage);
          }
        } else {
          // Cloud connection timeout or error: Buffer to SD card offline queue
          Serial.println("[SCAN] Cloud communication failed. Caching scan to SD offline queue.");
          queueOfflineScan(id, getFormattedTimestamp());
          triggerMessageState("Offline Cached", "Slot #" + String(id));
        }
      }
    } else {
      // TRUE OFFLINE MODE: Save to SD card queue
      Serial.println("[SCAN] Offline Mode (WiFi down). Buffering scan to SD card offline queue.");
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
  if (!hasSD) {
    Serial.println("[SD] Warning: No SD card detected. Cannot cache offline scan.");
    return;
  }

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
    Serial.printf("[SD OFFLINE] Cached Slot #%d to /offline_queue.csv (%s)\n", id, timestamp.c_str());
  } else {
    Serial.println("[SD] Failed to open /offline_queue.csv for append.");
  }
}

unsigned long lastSyncCheck = 0;

/**
 * Pushes cached offline logs from SD card to server when internet is active.
 * Once successfully persisted, WIPES the SD card offline memory buffer!
 */
void syncOfflineLogsToServer()
{
  if (WiFi.status() != WL_CONNECTED || !hasSD || currentState != STATE_NORMAL) return;
  if (millis() - lastSyncCheck < 10000) return; // Check every 10 seconds
  lastSyncCheck = millis();

  if (!SD.exists("/offline_queue.csv")) return;

  File file = SD.open("/offline_queue.csv", FILE_READ);
  if (!file) return;

  if (file.size() == 0) {
    file.close();
    SD.remove("/offline_queue.csv");
    return;
  }

  Serial.println("[AUTO-SYNC] Offline records detected on SD card. Pushing to server...");

  String lines[50];
  int count = 0;
  while (file.available() && count < 50) {
    String l = file.readStringUntil('\n');
    l.trim();
    if (l.length() > 0) {
      lines[count++] = l;
    }
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
      // 200: Successfully recorded; 400: Handled/duplicate
      successCount++;
    } else {
      Serial.printf("[AUTO-SYNC] Network dropout during sync at slot #%d (Code %d). Stopping sync batch.\n", slotId, code);
      return; // Stop and retry on next cycle without wiping
    }
    delay(200);
  }

  // REQUIREMENT: "pushes its log and wipes its memory after successfully persisting"
  SD.remove("/offline_queue.csv");
  Serial.printf("[AUTO-SYNC] Successfully persisted %d offline records to server. SD offline queue wiped clean!\n", successCount);
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

/* ---------------- LOCAL WEB ROUTES (FALLBACK / DIAGNOSTICS) ---------------- */

void handleRoot()
{
  String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>FUTO Biometric Node - " + String(DEVICE_ID) + "</title>";
  html += "<style>body{font-family:Arial;background:#f4f6f9;margin:0;padding:20px;}.container{max-width:800px;margin:auto;}";
  html += ".card{background:white;padding:20px;margin-bottom:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.08);}";
  html += ".badge{padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;background:#10b981;color:white;}";
  html += ".btn{padding:10px 15px;background:#059669;color:white;text-decoration:none;border-radius:6px;display:inline-block;margin-right:10px;margin-bottom:8px;}";
  html += ".btn-danger{background:#dc2626;}";
  html += ".btn-blue{background:#2563eb;}";
  html += "</style></head><body><div class='container'>";
  html += "<div class='card'><h2>ESP32 Biometric Terminal (" + String(DEVICE_ID) + ")</h2>";
  String activeDisplayCourse = currentSessionCourse.length() > 0 ? currentSessionCourse : (String(DEFAULT_COURSE) + " (Standby)");
  html += "<p>Active Course: <b>" + activeDisplayCourse + "</b> | Cloud: <b>" + String(vercelBaseUrl) + "</b></p>";
  html += "<p>Status: <span class='badge'>ONLINE</span> | IP: " + WiFi.localIP().toString() + "</p>";
  html += "</div>";
  html += "<div class='card'><h3>Terminal Utilities</h3>";
  html += "<a class='btn btn-blue' href='/sync'>Push Offline Logs Now</a>";
  html += "<a class='btn' href='/download'>Download SD CSV</a>";
  html += "<a class='btn btn-danger' href='/wipe-sd' onclick=\"return confirm('Wipe SD offline files?')\">Wipe SD Cache</a>";
  html += "<a class='btn btn-danger' href='/clear' onclick=\"return confirm('Wipe sensor templates and SD card?')\">Factory Reset Sensor & SD</a>";
  html += "<br><a class='btn' href='" + String(vercelBaseUrl) + "' target='_blank'>Go to Cloud Dashboard</a></div>";
  html += "</div></body></html>";
  server.send(200, "text/html", html);
}

void handleSyncNow()
{
  lastSyncCheck = 0;
  syncOfflineLogsToServer();
  server.send(200, "text/html", "<html><body style='font-family:Arial;padding:20px;'><h2>Offline Sync Triggered!</h2><p>Check the serial monitor or LCD screen. Any pending offline records have been pushed and the SD offline buffer wiped.</p><a href='/'>Back to Terminal</a></body></html>");
}

void handleWipeSD()
{
  if (hasSD) {
    SD.remove("/logs.csv");
    SD.remove("/students.csv");
    SD.remove("/offline_queue.csv");
  }
  showMessage("SD Buffer Wiped", "Clean State");
  server.send(200, "text/html", "<html><body style='font-family:Arial;padding:20px;'><h2>SD Card Memory Wiped Clean!</h2><p>All cached offline logs and outdated CSV rosters have been deleted from the SD card. AS608 optical sensor templates remain intact.</p><a href='/'>Back to Terminal</a></body></html>");
}

void handleGetLogs()
{
  if (!hasSD) {
    server.send(200, "text/html", "<tr><td colspan='4'>SD Card Error</td></tr>");
    return;
  }
  File file = SD.open("/logs.csv");
  if (!file) {
    server.send(200, "text/html", "<tr><td colspan='4'>No logs found</td></tr>");
    return;
  }
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
  if (!hasSD) { server.send(500, "text/plain", "SD Card Missing"); return; }
  File file = SD.open("/logs.csv");
  if (!file) { server.send(404, "text/plain", "File not found"); return; }
  server.streamFile(file, "text/csv");
  file.close();
}

void handleClear()
{
  if (hasFinger) {
    finger.emptyDatabase();
    Serial.println("[FINGER] AS608 optical sensor database wiped clean!");
  }
  if (hasSD) {
    SD.remove("/logs.csv");
    SD.remove("/students.csv");
    SD.remove("/offline_queue.csv");
    File file = SD.open("/logs.csv", FILE_WRITE);
    file.println("ID,Name,Timestamp,DeviceID,Status");
    file.close();
    File f2 = SD.open("/students.csv", FILE_WRITE);
    f2.close();
  }
  showMessage("Sensor Wiped", "Clean Slate");
  server.send(200, "text/html", "<html><body style='font-family:Arial;padding:20px;'><h2>AS608 Fingerprint Sensor & Rosters Wiped!</h2><p>All template slots have been cleared. Ready for fresh real enrollment.</p><a href='/'>Back to Terminal</a></body></html>");
}

void handleEnroll()
{
  if (!server.hasArg("name")) {
    server.send(400, "text/plain", "Missing Name");
    return;
  }
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
