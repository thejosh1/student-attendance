# W.O.R.C: Wireless Operations for Real-time Check-in
## Comprehensive System Architecture & Operational User Manual

---

## 📑 Table of Contents
1. [Acronym Breakdown: Meaning of W.O.R.C](#1-acronym-breakdown-meaning-of-worc)
2. [High-Level Architecture & Communication Flow](#2-high-level-architecture--communication-flow)
3. [Page-by-Page Feature & Button Breakdown](#3-page-by-page-feature--button-breakdown)
   - [3.1 Live Attendance Dashboard (`/`)](#31-live-attendance-dashboard-)
   - [3.2 Student Enrollment Portal & Modal (`/enroll`)](#32-student-enrollment-portal--modal-enroll)
   - [3.3 Lecturer Class Sessions Portal (`/lecturer`)](#33-lecturer-class-sessions-portal-lecturer)
   - [3.4 Biometric Devices Hub (`/devices`)](#34-biometric-devices-hub-devices)
   - [3.5 ESP32 Hardware & Firmware Hub (`/firmware`)](#35-esp32-hardware--firmware-hub-firmware)
4. [Hardware Subsystem: Microcontroller & Sensors](#4-hardware-subsystem-microcontroller--sensors)
5. [Backend API Engine & Security Enforcement](#5-backend-api-engine--security-enforcement)
6. [Database Layer: MongoDB with Autonomous Fallback](#6-database-layer-mongodb-with-autonomous-fallback)

---

## 1. Acronym Breakdown: Meaning of W.O.R.C

The name **W.O.R.C** embodies the technical essence and mission of this biometric engineering platform:

| Letter | Word | Engineering Meaning & Purpose |
| :---: | :--- | :--- |
| **W** | **Wireless** | The terminal relies on **WiFi (IEEE 802.11 b/g/n)** via the onboard ESP32 radio transceiver. It transmits encrypted telemetry and biometric verification packets over HTTPS directly to the cloud without needing tethered Ethernet or USB cables. |
| **O** | **Operations** | Represents the full-lifecycle **management suite**: device provisioning, classroom hardware toggling, student enrollment, template allocation, session scheduling, and audit trail logs. |
| **R** | **Real-time** | Attendance verification takes **under 350 milliseconds**. Scans are immediately processed, timestamped with the DS3231 hardware clock, evaluated against late arrival thresholds, and broadcast to the dashboard via live polling. |
| **C** | **Check-in** | The automated, fraud-proof **biometric logging mechanism**. Using an optical fingerprint scanner, students verify physical presence, eliminating proxy attendance, buddy punching, and manual paper rosters. |

---

## 2. High-Level Architecture & Communication Flow

```
[ Student Finger ]
       │
       ▼
[ AS608 Optical Sensor (500 DPI) ]
       │ UART (57600 baud on GPIO 16/17)
       ▼
[ ESP32 Microcontroller ] ──(WiFi / HTTPS POST)──► [ Next.js API / Vercel Cloud ]
   ├─ DS3231 RTC (Precise Timestamp)                         │
   ├─ MicroSD Card (Offline Fallback)                        ├─ Checks: Is device enabled?
   └─ 16x2 I2C LCD (Visual Status Feedback)                  ├─ Checks: On-time vs Late Cutoff
                                                             └─ Persists: MongoDB / Memory
                                                                     │
                                                             [ Live Web Dashboard ]
                                                             - Real-time roster updates
                                                             - Lecturer session controls
                                                             - Student enrollment modal
```

---

## 3. Page-by-Page Feature & Button Breakdown

### 3.1 Live Attendance Dashboard (`/`)

The primary command center for monitoring attendance in real-time.

#### A. Top Ribbon & Institutional Header
- **Top Ribbon**: Displays `W.O.R.C · Wireless Operations for Real-time Check-in`, the real-time cloud sync beacon (pulsing green indicator), and the current active hardware unit (`DEV-FUTO-01`).
- **Institutional Crest / Fingerprint Icon**: Gradient brand logo symbolizing optical biometric security.
- **Session Date Indicator**: Reflects current local calendar date (e.g., `2026-10-12`).
- **Late Cutoff Threshold**: Highlights the cutoff time (default `08:15 AM`). Any scan after this minute transitions automatically to **Late Arrival**.
- **Active Session Module**: Shows the current course topic being tracked (e.g. *Embedded Microcontrollers & IoT Architecture*).

#### B. Scanner Node Selector & Action Controls
- **Node Dropdown (`Node: DEV-FUTO-01`)**:
  - Allows the user or administrator to select which hardware scanner unit they are inspecting or simulating scans from.
  - Shows status next to each item (`ENABLED` or `DISABLED`).
- **"Simulate Scan on [Node]" Button**:
  - **Function**: Selects a student currently marked as absent and performs a simulated optical scan on the chosen hardware unit.
  - **Dynamic State**:
    - If the selected unit is **ENABLED** (`DEV-FUTO-01`), the button is black (`bg-slate-900`) and the scan succeeds with an audible toast alert.
    - If the selected unit is **DISABLED** (`DEV-FUTO-02`, `03`, or `04`), the button turns warning crimson (`bg-rose-700`), and clicking triggers an **HTTP 403 Access Denied** alert, demonstrating hardware policy enforcement.
- **"+ Enroll Student" Button**:
  - Fast-action link that navigates directly to the dedicated enrollment portal at `/enroll`.

#### C. Disabled Device Alert Banner
- When a disabled terminal is selected, a warning banner appears explaining that the device is currently deactivated by the lecturer and that scans will be rejected until enabled in the **Biometric Devices Hub**.

#### D. Live Metrics Counter Cards
- **Enrolled Students**: Total number of registered student profiles in the database.
- **Present (Verified)**: Total students checked in before the late cutoff.
- **Late Arrivals**: Students whose biometric check-in occurred after the late threshold.
- **Absent**: Enrolled students who have not yet scanned their fingerprints.
- **Attendance Rate (%)**: Calculated formula: `(Present + Late) / Total * 100`.

#### E. Toolbar: Search & Tabbed Filters
- **Search Input Field**: Live search filtering by student name, matriculation/reg number, course code, or email address.
- **Course Dropdown**: Filters attendance by specific course code (`TCE 511`, `TCE 504`, `TCE 512`, `TCE 514`, or `All Courses`).
- **Filter Tabs (`All Students`, `Present`, `Late`, `Absent`)**: One-click pills to isolate specific attendance status cohorts.

#### F. Attendance Data Table
- **Student Details Column**: Two-letter avatar badge, student full name, matriculation number, and allocated biometric template slot number (`Slot: #2001`).
- **Course Code Column**: Course badge (e.g. `TCE 511`).
- **Biometric Check-In Column**: Exact timestamp of first scan (`07:45 AM`) with green status dot, or `—` if absent.
- **Biometric Check-Out Column**: Timestamp of departure scan (if scanned after minimum 30-minute lecture duration).
- **Method & Sensor Node Column**: Optical scanner verification tag (`AS608 Optical`).
- **Status Column**: Color-coded pill:
  - 🟢 **Present**: Checked in before cutoff.
  - 🟡 **Late Arrival**: Checked in after cutoff.
  - 🔴 **Absent**: No scan recorded today.

---

### 3.2 Student Enrollment Portal & Modal (`/enroll`)

The dedicated registration workspace where student profiles are paired with optical fingerprint slots.

#### A. Header & KPI Metrics
- **Total Enrolled**: Total students registered in the university biometric database.
- **Active Sensor Node**: Primary optical reader assigned for registration (`DEV-FUTO-01`).
- **Next Template Slot**: Auto-calculated next available memory index in the AS608 optical sensor (e.g. `Slot #2015`).
- **Optical Security Indicator**: `AS608 500 DPI` with dual-scan template generation.

#### B. "+ Enroll New Student" Button
- Opens the **Enrollment Modal Dialog**.

#### C. Enrollment Modal Breakdown
1. **Full Name Field**: Full name of the student (e.g., `Chukwuemeka Franklin Obi`).
2. **Registration / Matric No Field**: Matriculation number format (e.g., `2021/130455`). Accepts any valid input for demo.
3. **Email Address Field**: University email address (e.g., `student@futo.edu.ng`). Accepts any valid email for demo.
4. **Course / Department Select**: Assigns the student to their designated course (`TCE 511`, `TCE 504`, `TCE 512`, `TCE 514`).
5. **Biometric Slot ID Input**: Displays the auto-assigned optical memory slot (e.g., `2015`), editable if a specific hardware slot is needed.
6. **Target Hardware Biometric Unit Box**: Confirms the physical unit where template minutiae will be registered (`DEV-FUTO-01 - Hall A`).
7. **Simulated Fingerprint Optical Window (State Machine)**:
   - Visualizes the 4-phase enrollment process matching the ESP32 hardware workflow:
     - **Phase 1 (`place1`)**: *"Place Finger on Optical Prism..."* (Sensor captures primary optical bitmap).
     - **Phase 2 (`remove`)**: *"Lift Finger momentarily..."* (Prism cleared).
     - **Phase 3 (`place2`)**: *"Place Same Finger Again to Confirm..."* (Sensor captures confirmation bitmap and builds mathematical minutiae model).
     - **Phase 4 (`done`)**: *"Template Verified & Ready to Save!"* (Visual green checkmark).
8. **"Simulate Optical Sensor Scan" Button**:
   - Triggers the 4-phase verification sequence in the browser, allowing full enrollment testing even when the physical ESP32 is not plugged into the computer.
9. **"Cancel" Button**: Closes the dialog without saving.
10. **"Complete Enrollment" Button**:
    - Dispatches a POST request to `/api/biometric/enroll`.
    - Persists the record to MongoDB/Store.
    - Generates an instant attendance entry.
    - Updates the table in real-time and displays a congratulatory toast notification.

---

### 3.3 Lecturer Class Sessions Portal (`/lecturer`)

The faculty management portal where lecturers schedule attendance sessions and assign physical hardware scanners.

#### A. "Set Attendance For Class" Form
- **Select Course Dropdown**: Choose between `TCE 511`, `TCE 504`, `TCE 512`, or `TCE 514`. Selecting a course automatically pairs it with its dedicated hardware unit.
- **Lecture Topic / Module Title Input**: Specific lecture subject (e.g., *Microprocessor Bus Interfacing & Timers*).
- **Lecturer Name Input**: Course lecturer in charge (e.g., *Engr. Prof. K. C. Okafor*).
- **Session Date Input**: Calendar date for the attendance window.
- **Start Time Input**: Lecture commencement time (e.g., `08:00 AM`).
- **Late Cutoff (Threshold) Input**: The pivotal attendance boundary (e.g., `08:15 AM`). Scans logged after this minute are automatically classified as Late.
- **End Time Input**: Lecture conclusion time (e.g., `10:00 AM`).
- **Assigned Fingerprint Hardware Node Dropdown**: Selects the physical reader for the class.
  - If an active terminal is selected (`DEV-FUTO-01`), displays a green indicator: `Enabled & Online (Accepts Scans)`.
  - If a disabled terminal is selected (`DEV-FUTO-02`, `03`, `04`), displays a warning badge: `DISABLED by Lecturer (Scans Rejected)`.
- **"Activate Attendance Session" Button**: Submits the session parameters to `/api/sessions` and starts live tracking.

#### B. Class Attendance Sessions List
- Displays cards for all configured course sessions.
- **Course Code Badge**: High-contrast badge identifying the class.
- **Live Status Tag**: Pulsing green badge (`LIVE / ACTIVE`) or gray badge (`Concluded`).
- **"Activate / End Session" Toggle Button**: Allows the lecturer to open or close attendance collection with a single click.
- **Session Meta Grid**: Displays Date, Time Window, Late Cutoff threshold, and Assigned Hardware Node status.

---

### 3.4 Biometric Devices Hub (`/devices`)

The central hardware controller for managing physical terminals across campus classrooms.

#### A. System Configuration: 4 Units (1 Active, 3 Disabled)
As specified by the system architecture, four terminals are provisioned, with exactly **1 enabled** and **3 disabled**:

1. **`DEV-FUTO-01` (Lecture Theatre Hall A / TCE 511)**:
   - **Status**: 🟢 **ENABLED (Active)**
   - **Role**: Primary online scanner accepting student fingerprints.
2. **`DEV-FUTO-02` (Telecom Lab 3 / TCE 504)**:
   - **Status**: 🔴 **DISABLED**
   - **Role**: Deactivated; scans rejected by security policy.
3. **`DEV-FUTO-03` (RF & Microwave Lab / TCE 512)**:
   - **Status**: 🔴 **DISABLED**
   - **Role**: Deactivated; scans rejected by security policy.
4. **`DEV-FUTO-04` (Central Auditorium / TCE 514)**:
   - **Status**: 🔴 **DISABLED**
   - **Role**: Deactivated; scans rejected by security policy.

#### B. Interactive Terminal Card Controls
- **Toggle Switch (Green / Gray slider)**:
  - Allows instant enabling or disabling of any terminal.
  - Sends a PATCH request to `/api/devices` updating the database state immediately.
- **Hardware Specs Section**:
  - Displays Classroom Location, Model (`ESP32-WROOM-32 + AS608 Optical`), IP Address, MAC Address, and Battery Level (%).
- **"Test Scan on Node" Button**:
  - Sends a test scan payload to `/api/biometric/scan` through that specific device.
  - **On Enabled Device (`DEV-FUTO-01`)**: Displays green callout: `✓ Scan Accepted (200 OK)`.
  - **On Disabled Device (`DEV-FUTO-02`, `03`, `04`)**: Displays red callout: `✕ Scan Rejected (403 Forbidden): Device is disabled by lecturer`.

---

### 3.5 ESP32 Hardware & Firmware Hub (`/firmware`)

The engineering resource center for hardware technicians and embedded developers.

#### A. Action Buttons
- **"Download Hardware ZIP Package (.zip)" Button**:
  - Downloads the complete bundled archive: `futo_esp32_hardware_package.zip`.
  - Contains the ready-to-flash Arduino sketch in a dedicated folder (`futo_attendance_esp32/futo_attendance_esp32.ino`) plus the complete hardware wiring manual.
- **"Download .INO Sketch" Button**:
  - Directly downloads the raw `.ino` sketch file.
- **"Copy Code" Button**:
  - Copies the complete C++ firmware source code to the clipboard.

#### B. Architectural Guide Cards
1. **How the Device Talks to Vercel**: Explains `HTTPClient` with SSL encryption and `client.setInsecure()`.
2. **Disabled Devices Enforcement**: Details how HTTP 403 responses trigger the `ACCESS BLOCKED` LCD message.
3. **Offline SD Card Fallback**: Details the failover procedure to MicroSD storage and subsequent cloud resynchronization.

#### C. Wiring Pinout Reference Table
Provides exact pin-to-pin wiring for the ESP32:
- AS608 Fingerprint RX/TX ➔ GPIO 16 (RX2) and GPIO 17 (TX2) at 57600 baud.
- DS3231 RTC & I2C LCD SDA/SCL ➔ GPIO 21 and GPIO 22.
- MicroSD SPI CS / MOSI / MISO / SCK ➔ GPIO 5, 23, 19, 18.

#### D. Terminal Curl Test Examples
Provides pre-formatted `curl` commands for testing the live cloud endpoints from any terminal or Postman.

---

## 4. Hardware Subsystem: Microcontroller & Sensors

### Physical State Machine Flowchart

```
       [ BOOT / SETUP ]
              │
    Check LCD, RTC, SD, AS608
              │
    Connect WiFi to W.O.R.C Cloud
              │
              ▼
       [ STATE_NORMAL ]
  Wait for Finger on Optical Prism
              │
       (Finger Detected)
              │
   Match Template via AS608
              │
      Match Found? (fingerID)
        │                 │
      [YES]              [NO] ➔ LCD: "ACCESS DENIED"
        │
   HTTPS POST to Vercel Cloud API
        │
   Response Code?
    ├─ 200 OK ──────────► LCD: "Verified! <Student Name>"
    ├─ 403 Forbidden ───► LCD: "ACCESS BLOCKED: Device Disabled"
    └─ WiFi Down / 500 ─► LCD: "Saved Offline" (Appends to SD Card /logs.csv)
```

---

## 5. Backend API Engine & Security Enforcement

| Route | Method | Payload / Params | Function & Logic |
| :--- | :---: | :--- | :--- |
| `/api/biometric/scan` | `POST` | `{ deviceUserId, deviceId, classId, timestamp }` | Main check-in endpoint. Verifies device status (rejects with 403 if disabled). Compares timestamp against late cutoff. Logs check-in or check-out. |
| `/api/biometric/enroll` | `POST` | `{ name, admissionNo, email, className, deviceUserId, deviceId }` | Enrolls a new student, generates profile, assigns optical template slot, and inserts initial records. |
| `/api/attendance` | `GET` | `?date=YYYY-MM-DD&class=TCE+511` | Returns today's consolidated roster with computed status (`present`, `late`, `absent`). |
| `/api/devices` | `GET` | None | Returns list of all 4 provisioned hardware terminals. |
| `/api/devices` | `PATCH` | `{ deviceId, isEnabled }` | Toggles hardware terminal active status. |
| `/api/sessions` | `GET` | None | Returns list of configured class attendance sessions. |
| `/api/sessions` | `POST` | `{ courseCode, topic, lecturerName, startTime, lateCutoff, endTime, deviceId }` | Creates and launches a new class attendance session. |
| `/api/sessions` | `PATCH` | `{ sessionId }` | Toggles session between Active and Concluded. |
| `/api/students` | `GET` | None | Returns student directory roster. |
| `/api/firmware` | `GET` | None | Serves the `.ino` firmware sketch file for direct download. |
| `/api/hardware-zip` | `GET` | None | Serves `futo_esp32_hardware_package.zip` for direct download. |

---

## 6. Database Layer: MongoDB with Autonomous Fallback

The data access layer in `lib/store.ts` and `lib/mongodb.ts` implements a resilient dual-mode strategy:

1. **MongoDB Atlas Production Mode**:
   - When the `MONGODB_URI` environment variable is defined in Vercel or `.env.local`, the platform automatically pools connections and queries MongoDB collections (`students`, `attendance`, `devices`, `sessions`).
2. **Autonomous In-Memory Fallback Mode**:
   - If `MONGODB_URI` is not provided (e.g. during rapid local prototyping or offline testing), the platform runs smoothly using a memory-persistent cache stored in `globalThis.__attendanceStore`.
   - **Zero Setup Obstacles**: The app will never crash with database connection errors; it functions immediately upon installation.
