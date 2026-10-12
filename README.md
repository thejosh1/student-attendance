# FUTO Student Attendance Management System (ESP32 Cloud Biometrics)

A real-time biometric fingerprint attendance management platform for the **Federal University of Technology, Owerri (FUTO)** - School of Engineering and Engineering Technology (SEET).

Incorporates your ESP32 Arduino hardware code (AS608 Optical Sensor, DS3231 RTC, MicroSD module, 16x2 LCD) with a modern Next.js + NestJS-style architecture, MongoDB persistence, dedicated student enrollment modal, and multi-device classroom hardware management (4 units configured, 3 disabled by default).

---

## 🚀 Key Features

1. **Hardware-to-Cloud Synchronization (ESP32 -> Vercel)**:
   - Your original Arduino sketch has been upgraded to talk directly to your Vercel deployment over HTTPS using `WiFiClientSecure` (`client.setInsecure()`) and `HTTPClient`.
   - Sends real-time POST requests to `/api/biometric/scan` with template ID, device ID, course code, and timestamp.
   - Offline fallback: continues saving locally to `/logs.csv` on the MicroSD card if WiFi is unavailable, and auto-syncs when reconnected.

2. **Dedicated Student Enrollment Page (`/enroll`) & Modal**:
   - Clean page at `/enroll` showing student directory, stats, and search.
   - Click **"+ Enroll New Student"** to open the registration modal.
   - Asks for:
     - **Full Name**
     - **Registration / Matric Number** (e.g., `2021/130455` - any input accepted for demo)
     - **Email Address** (e.g., `student@futo.edu.ng` - any valid email accepted for demo)
     - **Course Selection** (`COE 505`, `ECE 513`, `MEE 501`, `CSC 507`)
     - **Biometric Slot ID** (Auto-allocated or custom)
     - **Interactive 2-Step Optical Sensor Capture** (Place finger -> Remove -> Confirm -> Save) with a built-in simulation button for testing without hardware.

3. **Lecturer Class Attendance Manager (`/lecturer`)**:
   - Lecturers can set attendance sessions for each course.
   - Configure session date, topic, start time, late cutoff threshold (e.g. `08:15 AM`), end time, and assigned fingerprint device.
   - Live session activation toggles and real-time attendance stats.

4. **Multi-Device Hardware Control (`/devices`)**:
   - Configured with **4 physical fingerprint units**, with **exactly 3 disabled by default**:
     - `DEV-FUTO-01`: Hall A / COE 505 -> **ENABLED (🟢 Active)**
     - `DEV-FUTO-02`: Lab 3 / ECE 513 -> **DISABLED (🔴 Inactive)**
     - `DEV-FUTO-03`: Workshop / MEE 501 -> **DISABLED (🔴 Inactive)**
     - `DEV-FUTO-04`: Auditorium / CSC 507 -> **DISABLED (🔴 Inactive)**
   - Security Enforcement: Any scan arriving from a disabled unit is rejected with **HTTP 403 Forbidden**, triggering a "DEVICE DISABLED" alert on the ESP32 LCD/Serial and dashboard!

5. **MongoDB Persistence & NestJS Service Architecture**:
   - Built with MongoDB integration via `mongodb` connection pooling (`lib/mongodb.ts` and `lib/store.ts`).
   - Clean NestJS DTO, Service, and Controller layer in `server/nestjs-architecture/`.
   - Automatic fallback to in-memory store so the app runs out of the box with zero setup locally and seamlessly connects to MongoDB Atlas when `MONGODB_URI` is added.

---

## 🛠️ Quick Start

```bash
# Install dependencies
npm install

# Start local Next.js dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Live Attendance Dashboard**: [http://localhost:3000/](http://localhost:3000/)
- **Student Enrollment Portal**: [http://localhost:3000/enroll](http://localhost:3000/enroll)
- **Lecturer Sessions Portal**: [http://localhost:3000/lecturer](http://localhost:3000/lecturer)
- **Biometric Devices Hub**: [http://localhost:3000/devices](http://localhost:3000/devices)
- **ESP32 Firmware & Wiring Guide**: [http://localhost:3000/firmware](http://localhost:3000/firmware)

---

## ☁️ Deploying to Vercel

1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. In **Project Settings > Environment Variables**, optionally add:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/futo_attendance?retryWrites=true&w=majority
   MONGODB_DB_NAME=futo_attendance
   ```
4. Deploy! Your API endpoints will be live at `https://<your-project>.vercel.app`.

---

## 📟 ESP32 Microcontroller Setup

1. Open `firmware/futo_attendance_esp32.ino` in Arduino IDE or VS Code PlatformIO.
2. Set your WiFi credentials:
   ```cpp
   const char* ssid = "YOUR_WIFI_NAME";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
3. Set your Vercel deployment URL:
   ```cpp
   const char* vercelBaseUrl = "https://your-project.vercel.app";
   ```
4. Flash to your ESP32 board and verify via Serial Monitor (`115200` baud).
