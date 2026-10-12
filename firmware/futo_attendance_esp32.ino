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
const char* vercelBaseUrl = "https://student-attendance-peach.vercel.app";
const char* scanEndpoint   = "/api/biometric/scan";
const char* enrollEndpoint = "/api/biometric/enroll";


// 3. Hardware Unit Identity (Each lecture hall has its assigned unit)
// Active unit in this demo: "DEV-FUTO-01" (Hall A / TCE 511)
// Other units configured in system: DEV-FUTO-02, DEV-FUTO-03, DEV-FUTO-04 (Disabled by default)
const char* DEVICE_ID = "DEV-FUTO-01";
const char* ASSIGNED_COURSE = "TCE 511";

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
    showMessage("Scan Fingerprint", String(DEVICE_ID) + " [ONLINE]");
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

/* ---------------- CLOUD API SYNCHRONIZATION ---------------- */

/**
 * Sends biometric scan to Vercel API over HTTPS
 * Handles Device Disabled state, Duplicates, and Check-In/Check-Out
 */
bool sendScanToCloud(int fingerId, String &outMessage) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[CLOUD] WiFi not connected. Cannot reach Vercel.");
    outMessage = "WiFi Disconnected";
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
    https.setTimeout(6000);

    // Build JSON payload
    String payload = "{";
    payload += "\"deviceUserId\":\"" + String(fingerId) + "\",";
    payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
    payload += "\"classId\":\"" + String(ASSIGNED_COURSE) + "\",";
    payload += "\"timestamp\":\"" + getFormattedTimestamp() + "\",";
    payload += "\"method\":\"fingerprint\"";
    payload += "}";

    int httpCode = https.POST(payload);
    Serial.printf("[CLOUD] Response Code: %d\n", httpCode);

    if (httpCode > 0) {
      String response = https.getString();
      Serial.println("[CLOUD] Payload: " + response);

      if (httpCode == 200) {
        // Success (Check-in, Check-out, or Duplicate)
        if (response.indexOf("duplicate") > 0) {
          outMessage = "Already Scanned";
        } else if (response.indexOf("check-out") > 0) {
          outMessage = "Checked Out";
        } else {
          outMessage = "Verified!";
        }
        https.end();
        return true;
      } else if (httpCode == 400) {
        if (response.indexOf("wrong-class") > 0 || response.indexOf("CLASS MISMATCH") > 0) {
          outMessage = "Wrong Class!";
        } else if (response.indexOf("no-session") > 0 || response.indexOf("NO ACTIVE CLASS") > 0) {
          outMessage = "No Class Active";
        } else {
          outMessage = "Scan Rejected";
        }
        https.end();
        return false;
      } else if (httpCode == 403) {
        // LECTURER DISABLED THIS DEVICE!
        outMessage = "DEVICE DISABLED";
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
    }
    https.end();
  }
  return false;
}

/**
 * Syncs student enrollment to Vercel API over HTTPS
 */
bool sendEnrollToCloud(int fingerId, String name, String regNo, String email) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[CLOUD ENROLL] WiFi not connected. Saved to SD card only.");
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

    String payload = "{";
    payload += "\"deviceUserId\":\"" + String(fingerId) + "\",";
    payload += "\"name\":\"" + name + "\",";
    payload += "\"admissionNo\":\"" + regNo + "\",";
    payload += "\"email\":\"" + email + "\",";
    payload += "\"className\":\"" + String(ASSIGNED_COURSE) + "\",";
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

        showMessage("Place Finger", enrollName);
        stateTimer = millis();
        currentState = STATE_ENROLL_WAIT_1;
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
    if (!SD.exists("/students.csv")) {
      File file = SD.open("/students.csv", FILE_WRITE);
      file.close();
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
          if (hasSD) {
            File file = SD.open("/students.csv", FILE_APPEND);
            if (file) {
              file.print(enrollID);
              file.print(",");
              file.print(enrollName);
              file.print(",");
              file.print(enrollRegNo);
              file.print(",");
              file.println(enrollEmail);
              file.close();
            }
          }
          sendEnrollToCloud(enrollID, enrollName, enrollRegNo, enrollEmail);
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

    String name = getStudentName(id);
    Serial.printf("[SCAN] Finger Match Found! Template ID: %d | Local Name: %s\n", id, name.c_str());

    // 1. ATTEMPT CLOUD SYNC WITH VERCEL API
    String cloudResult = "";
    bool cloudSuccess = sendScanToCloud(id, cloudResult);

    if (cloudSuccess) {
      triggerMessageState(name, cloudResult);
      logAttendance(id, name, "CLOUD_SYNCED");
    } else {
      if (cloudResult == "DEVICE DISABLED") {
        // LECTURER DISABLED THIS DEVICE!
        triggerMessageState("ACCESS BLOCKED", "Device Disabled");
      } else if (cloudResult == "Wrong Class!" || cloudResult == "No Class Active" || cloudResult == "Scan Rejected") {
        // TERMINAL ASSIGNED TO DIFFERENT CLASS OR NO SESSION ACTIVE
        triggerMessageState("ACCESS REJECTED", cloudResult);
      } else if (cloudResult == "Not Enrolled") {
        triggerMessageState("ACCESS REJECTED", "Not Enrolled");
      } else {
        // FALLBACK TO OFFLINE SD STORAGE
        triggerMessageState(name, "Saved Offline");
        logAttendance(id, name, "OFFLINE_CACHED");
      }
    }
  } else {
    triggerMessageState("ACCESS DENIED", "Not Recognized");
  }
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

void logAttendance(int id, String name, String syncStatus)
{
  if (!hasSD) {
    Serial.println("[SD] Skipping SD write - no card.");
    return;
  }

  String timeStamp = getFormattedTimestamp();

  File file = SD.open("/logs.csv", FILE_APPEND);
  if (file) {
    file.print(id);
    file.print(",");
    file.print(name);
    file.print(",");
    file.print(timeStamp);
    file.print(",");
    file.print(DEVICE_ID);
    file.print(",");
    file.println(syncStatus);
    file.close();
    Serial.println("[SD] Logged to SD card successfully.");
  }
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
  html += ".btn{padding:10px 15px;background:#059669;color:white;text-decoration:none;border-radius:6px;display:inline-block;margin-right:10px;}";
  html += "</style></head><body><div class='container'>";
  html += "<div class='card'><h2>ESP32 Biometric Terminal (" + String(DEVICE_ID) + ")</h2>";
  html += "<p>Assigned Course: <b>" + String(ASSIGNED_COURSE) + "</b> | Cloud: <b>" + String(vercelBaseUrl) + "</b></p>";
  html += "<p>Status: <span class='badge'>ONLINE</span> | IP: " + WiFi.localIP().toString() + "</p>";
  html += "</div>";
  html += "<div class='card'><a class='btn' href='/download'>Download SD CSV</a>";
  html += "<a class='btn' href='" + String(vercelBaseUrl) + "' target='_blank'>Go to Vercel Cloud Dashboard</a></div>";
  html += "</div></body></html>";
  server.send(200, "text/html", html);
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
