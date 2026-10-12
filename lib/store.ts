import {
  AttendanceRecord,
  BiometricDevice,
  ClassSession,
  Student,
  initialDevices,
  initialSessions,
  seedRecords,
  students as defaultStudents,
} from "./data";
import clientPromise from "./mongodb";

export interface PendingEnrollCommand {
  deviceId: string;
  slotId: number;
  name: string;
  admissionNo: string;
  email: string;
  className: string;
  createdAt: number;
}

// Persistent store in globalThis for Next.js hot module reloading & memory cache
interface GlobalAttendanceStore {
  students: Student[];
  records: AttendanceRecord[];
  devices: BiometricDevice[];
  sessions: ClassSession[];
  pendingEnrollments: Record<string, PendingEnrollCommand>;
  initialized: boolean;
}

const g = globalThis as unknown as { __attendanceStore?: GlobalAttendanceStore };

export const store: GlobalAttendanceStore = (g.__attendanceStore ??= {
  students: [...defaultStudents],
  records: seedRecords(),
  devices: [...initialDevices],
  sessions: [...initialSessions],
  pendingEnrollments: {},
  initialized: false,
});

// Backward compatibility export
export const records = store.records;
export const students = store.students;

/**
 * Sync with MongoDB if MONGODB_URI is provided.
 * Seamlessly falls back to store in memory if MongoDB is offline or not configured.
 */
export async function getDb() {
  if (!clientPromise) return null;
  try {
    const client = await clientPromise;
    return client.db(process.env.MONGODB_DB_NAME || "futo_attendance");
  } catch (err) {
    console.warn("MongoDB connection warning (falling back to in-memory store):", err);
    return null;
  }
}

/**
 * Initialize MongoDB collections if empty
 */
export async function initDbIfConnected() {
  const db = await getDb();
  if (!db || store.initialized) return;

  try {
    const studentCount = await db.collection("students").countDocuments();
    if (studentCount === 0) {
      if (store.students.length > 0) await db.collection("students").insertMany(store.students as any);
      if (store.records.length > 0) await db.collection("attendance").insertMany(store.records as any);
      if (store.devices.length > 0) await db.collection("devices").insertMany(store.devices as any);
      if (store.sessions.length > 0) await db.collection("sessions").insertMany(store.sessions as any);
    } else {
      // Hydrate memory from MongoDB
      const dbStudents = (await db.collection("students").find({}).toArray()) as any;
      const dbRecords = (await db.collection("attendance").find({}).toArray()) as any;
      const dbDevices = (await db.collection("devices").find({}).toArray()) as any;
      const dbSessions = (await db.collection("sessions").find({}).toArray()) as any;

      store.students = dbStudents || [];
      store.records = dbRecords || [];
      if (dbDevices?.length > 0) store.devices = dbDevices;
      if (dbSessions?.length > 0) store.sessions = dbSessions;
    }
    store.initialized = true;
  } catch (err) {
    console.warn("Failed to initialize MongoDB collections:", err);
  }
}

export async function getAllStudents(): Promise<Student[]> {
  const db = await getDb();
  if (db) {
    try {
      const items = (await db.collection("students").find({}).toArray()) as any;
      store.students = items;
      return items;
    } catch (e) {
      console.warn("Mongo fetch students error:", e);
    }
  }
  return store.students;
}

export async function addStudent(student: Student): Promise<Student> {
  // Check if student with same slot or matric number already exists
  const existingIdx = store.students.findIndex(
    (s) => s.deviceUserId === student.deviceUserId || s.admissionNo === student.admissionNo
  );
  if (existingIdx >= 0) {
    store.students[existingIdx] = student;
  } else {
    store.students.unshift(student);
  }

  const db = await getDb();
  if (db) {
    try {
      await db.collection("students").updateOne(
        { $or: [{ deviceUserId: student.deviceUserId }, { admissionNo: student.admissionNo }] },
        { $set: { ...student } },
        { upsert: true }
      );
    } catch (e) {
      console.warn("Mongo add student error:", e);
    }
  }
  return student;
}

export async function deleteStudent(studentIdOrSlot: string): Promise<boolean> {
  const target = store.students.find(
    (s) => s.id === studentIdOrSlot || s.deviceUserId === studentIdOrSlot
  );
  store.students = store.students.filter(
    (s) => s.id !== studentIdOrSlot && s.deviceUserId !== studentIdOrSlot
  );
  if (target) {
    store.records = store.records.filter((r) => r.studentId !== target.id);
  }

  const db = await getDb();
  if (db) {
    try {
      await db.collection("students").deleteMany({
        $or: [{ id: studentIdOrSlot }, { deviceUserId: studentIdOrSlot }],
      });
      if (target) {
        await db.collection("attendance").deleteMany({ studentId: target.id });
      }
    } catch (e) {
      console.warn("Mongo delete student error:", e);
    }
  }
  return true;
}

export async function clearAllStudents(): Promise<void> {
  store.students = [];
  store.records = [];
  const db = await getDb();
  if (db) {
    try {
      await db.collection("students").deleteMany({});
      await db.collection("attendance").deleteMany({});
    } catch (e) {
      console.warn("Mongo clear all students error:", e);
    }
  }
}

export async function getAllAttendanceRecords(date?: string): Promise<AttendanceRecord[]> {
  const db = await getDb();
  if (db) {
    try {
      const query = date ? { date } : {};
      const items = (await db.collection("attendance").find(query).toArray()) as any;
      if (items && items.length > 0) {
        // Merge into in-memory store.records
        const existingIds = new Set(items.map((i: any) => `${i.studentId}_${i.date}`));
        store.records = [
          ...store.records.filter((r) => !existingIds.has(`${r.studentId}_${r.date}`)),
          ...items,
        ];
        return items;
      }
    } catch (e) {
      console.warn("Mongo fetch attendance error:", e);
    }
  }
  return date ? store.records.filter((r) => r.date === date) : store.records;
}

export async function clearAttendance(): Promise<void> {
  store.records = [];
  const db = await getDb();
  if (db) {
    try {
      await db.collection("attendance").deleteMany({});
    } catch (e) {
      console.warn("Mongo clear attendance error:", e);
    }
  }
}

export async function resetAllData(): Promise<void> {
  await clearAllStudents();
  store.initialized = true;
}


export async function getAllDevices(): Promise<BiometricDevice[]> {
  const db = await getDb();
  if (db) {
    try {
      const items = (await db.collection("devices").find({}).toArray()) as any;
      if (items.length > 0) return items;
    } catch (e) {
      console.warn("Mongo fetch devices error:", e);
    }
  }
  return store.devices;
}

export async function updateDeviceStatus(deviceId: string, isEnabled: boolean): Promise<BiometricDevice | null> {
  const dev = store.devices.find((d) => d.id === deviceId);
  if (dev) {
    dev.isEnabled = isEnabled;
    dev.status = isEnabled ? "online" : "disabled";
    dev.lastPing = isEnabled ? "Just now" : "Disabled by Lecturer";
  }
  const db = await getDb();
  if (db) {
    try {
      await db.collection("devices").updateOne(
        { id: deviceId },
        {
          $set: {
            isEnabled,
            status: isEnabled ? "online" : "disabled",
            lastPing: isEnabled ? "Just now" : "Disabled by Lecturer",
          },
        }
      );
    } catch (e) {
      console.warn("Mongo update device error:", e);
    }
  }
  return dev || null;
}

export function isSessionExpired(session: ClassSession, referenceDate?: Date): boolean {
  if (!session.endTime || !session.date) return false;

  const ref = referenceDate || new Date();
  const currentDate = ref.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const currentTime = ref.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (session.date < currentDate) return true;
  if (session.date === currentDate && currentTime >= session.endTime) return true;
  return false;
}

export async function getAllSessions(): Promise<ClassSession[]> {
  const norm = (c?: string) => (c || "").trim().toUpperCase();
  const db = await getDb();
  let list = store.sessions;
  if (db) {
    try {
      const items = (await db.collection("sessions").find({}).toArray()) as any;
      if (items && items.length > 0) {
        list = items;
        store.sessions = items;
      }
    } catch (e) {
      console.warn("Mongo fetch sessions error:", e);
    }
  }

  // REQUIREMENT: Once the time set has reached, the class should automatically end
  const dbUpdates: Promise<any>[] = [];
  for (const s of list) {
    if (s.isActive && isSessionExpired(s)) {
      s.isActive = false;
      if (!s.endedAt) {
        try {
          s.endedAt = new Date(`${s.date}T${s.endTime}:00+01:00`).toISOString();
        } catch {
          s.endedAt = new Date().toISOString();
        }
      }
      if (db) {
        dbUpdates.push(
          db.collection("sessions").updateOne(
            { id: s.id },
            { $set: { isActive: false, endedAt: s.endedAt } }
          )
        );
      }
    }
  }
  if (dbUpdates.length > 0) {
    Promise.all(dbUpdates).catch((err) => console.warn("Auto-expire session update error:", err));
  }

  // Deduplicate so there is ALWAYS strictly 1 class section per course code
  const seen = new Set<string>();
  const unique: ClassSession[] = [];
  const sorted = [...list].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
  for (const s of sorted) {
    const key = norm(s.courseCode);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }
  store.sessions = unique;
  return unique;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  store.sessions = store.sessions.filter((s) => s.id !== sessionId);
  const db = await getDb();
  if (db) {
    try {
      await db.collection("sessions").deleteOne({ id: sessionId });
    } catch (e) {
      console.warn("Mongo delete session error:", e);
    }
  }
  return true;
}

export async function deduplicateSessions(): Promise<ClassSession[]> {
  const norm = (c?: string) => (c || "").trim().toUpperCase();
  const seenCourses = new Set<string>();
  const uniqueSessions: ClassSession[] = [];

  // Prioritize active sessions first, then newer sessions
  const sorted = [...store.sessions].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
  for (const s of sorted) {
    const key = norm(s.courseCode);
    if (!seenCourses.has(key)) {
      seenCourses.add(key);
      uniqueSessions.push(s);
    }
  }
  store.sessions = uniqueSessions;

  const db = await getDb();
  if (db) {
    try {
      await db.collection("sessions").deleteMany({});
      if (uniqueSessions.length > 0) {
        await db.collection("sessions").insertMany(uniqueSessions as any);
      }
    } catch (e) {
      console.warn("Mongo deduplicate sessions error:", e);
    }
  }
  return store.sessions;
}

export async function addSession(session: ClassSession): Promise<ClassSession> {
  const db = await getDb();
  const norm = (c?: string) => (c || "").trim().toUpperCase();

  // Enforce strictly 1 session per course: prune any prior session with the same course code
  store.sessions = store.sessions.filter(
    (s) => norm(s.courseCode) !== norm(session.courseCode)
  );

  if (session.isActive) {
    // A fingerprint terminal CANNOT be taking attendance for 2 classes at once!
    for (const existing of store.sessions) {
      if (existing.deviceId === session.deviceId) {
        existing.isActive = false;
      }
    }
    if (db) {
      try {
        await db.collection("sessions").updateMany(
          { deviceId: session.deviceId },
          { $set: { isActive: false } }
        );
      } catch (e) {
        console.warn("Mongo deactivate existing device sessions error:", e);
      }
    }
  }

  store.sessions.unshift(session);
  if (db) {
    try {
      // Remove any duplicate in DB for same course
      await db.collection("sessions").deleteMany({
        courseCode: { $regex: new RegExp(`^${session.courseCode.trim()}$`, "i") },
      });
      await db.collection("sessions").insertOne({ ...session } as any);
    } catch (e) {
      console.warn("Mongo add session error:", e);
    }
  }
  return session;
}

export async function toggleSessionStatus(
  sessionId: string,
  action?: "end" | "activate" | "toggle"
): Promise<ClassSession | null> {
  const db = await getDb();
  await getAllSessions();

  let sess = store.sessions.find((s) => s.id === sessionId);
  if (!sess && db) {
    sess = (await db.collection("sessions").findOne({ id: sessionId })) as any;
    if (sess) {
      store.sessions.push(sess);
    }
  }
  if (!sess) return null;

  // An ended class cannot be reactivated under any circumstance
  if (!sess.isActive || action === "activate") {
    console.warn(`[Store] Blocked attempt to reactivate ended class: ${sess.courseCode} (${sessionId})`);
    return null;
  }

  // Ending the active session: record endedAt timestamp for the 30-min window
  sess.isActive = false;
  sess.endedAt = new Date().toISOString();
  if (db) {
    try {
      await db.collection("sessions").updateOne(
        { id: sessionId },
        { $set: { isActive: false, endedAt: sess.endedAt } }
      );
    } catch (e) {
      console.warn("Mongo end session error:", e);
    }
  }

  return sess;
}

export async function endSession(sessionId: string): Promise<ClassSession | null> {
  return await toggleSessionStatus(sessionId, "end");
}

export interface DeviceSessionStatus {
  deviceId: string;
  hasActiveSession: boolean;
  courseCode: string;
  topic: string;
  status: "active" | "ended" | "idle";
  displayLine1: string;
  displayLine2: string;
  endedAt: string | null;
  endedMinutesAgo: number | null;
  startTime?: string;
  endTime?: string;
  sessionDate?: string;
}

export async function getDeviceSessionStatus(deviceId: string): Promise<DeviceSessionStatus> {
  const sessions = await getAllSessions();

  // 1. Is there an active session currently assigned to this device?
  const activeSession = sessions.find((s) => s.deviceId === deviceId && s.isActive);
  if (activeSession) {
    return {
      deviceId,
      hasActiveSession: true,
      courseCode: activeSession.courseCode,
      topic: activeSession.topic,
      status: "active",
      displayLine1: `${activeSession.courseCode} [LIVE]`,
      displayLine2: "Place Finger",
      endedAt: null,
      endedMinutesAgo: null,
      startTime: activeSession.startTime,
      endTime: activeSession.endTime,
      sessionDate: activeSession.date,
    };
  }

  // 2. No active session. Check if any session for this device ended within the last 30 minutes
  const endedSessions = sessions
    .filter((s) => s.deviceId === deviceId && !s.isActive && s.endedAt)
    .sort((a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime());

  if (endedSessions.length > 0) {
    const mostRecent = endedSessions[0];
    const endedTime = new Date(mostRecent.endedAt!).getTime();
    const minutesAgo = Math.floor((Date.now() - endedTime) / 60000);

    if (minutesAgo >= 0 && minutesAgo < 30) {
      return {
        deviceId,
        hasActiveSession: false,
        courseCode: mostRecent.courseCode,
        topic: mostRecent.topic,
        status: "ended",
        displayLine1: mostRecent.courseCode,
        displayLine2: "Class Has Ended",
        endedAt: mostRecent.endedAt || null,
        endedMinutesAgo: minutesAgo,
        startTime: mostRecent.startTime,
        endTime: mostRecent.endTime,
        sessionDate: mostRecent.date,
      };
    }
  }

  // 3. Standby / Idle (no session or ended > 30 minutes ago)
  return {
    deviceId,
    hasActiveSession: false,
    courseCode: "",
    topic: "",
    status: "idle",
    displayLine1: "Scan Fingerprint",
    displayLine2: `${deviceId} Ready`,
    endedAt: endedSessions[0]?.endedAt || null,
    endedMinutesAgo:
      endedSessions.length > 0
        ? Math.floor((Date.now() - new Date(endedSessions[0].endedAt!).getTime()) / 60000)
        : null,
    startTime: endedSessions[0]?.startTime,
    endTime: endedSessions[0]?.endTime,
    sessionDate: endedSessions[0]?.date,
  };
}

export async function setPendingEnrollCommand(cmd: PendingEnrollCommand) {
  if (!store.pendingEnrollments) store.pendingEnrollments = {};
  store.pendingEnrollments[cmd.deviceId] = cmd;
  const db = await getDb();
  if (db) {
    try {
      await db.collection("pending_commands").updateOne(
        { deviceId: cmd.deviceId },
        { $set: cmd },
        { upsert: true }
      );
    } catch (e) {
      console.warn("Mongo set pending command error:", e);
    }
  }
}

export async function getPendingEnrollCommand(deviceId: string): Promise<PendingEnrollCommand | null> {
  const db = await getDb();
  if (db) {
    try {
      const item = (await db.collection("pending_commands").findOne({ deviceId })) as any;
      if (item && Date.now() - item.createdAt < 180000) {
        return item;
      }
    } catch (e) {
      console.warn("Mongo get pending command error:", e);
    }
  }
  if (!store.pendingEnrollments) store.pendingEnrollments = {};
  const cmd = store.pendingEnrollments[deviceId];
  if (cmd && Date.now() - cmd.createdAt < 180000) {
    return cmd;
  }
  return null;
}

export async function clearPendingEnrollCommand(deviceId: string) {
  if (store.pendingEnrollments) {
    delete store.pendingEnrollments[deviceId];
  }
  const db = await getDb();
  if (db) {
    try {
      await db.collection("pending_commands").deleteOne({ deviceId });
    } catch (e) {
      console.warn("Mongo clear pending command error:", e);
    }
  }
}

