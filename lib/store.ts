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

// Persistent store in globalThis for Next.js hot module reloading & memory cache
interface GlobalAttendanceStore {
  students: Student[];
  records: AttendanceRecord[];
  devices: BiometricDevice[];
  sessions: ClassSession[];
  initialized: boolean;
}

const g = globalThis as unknown as { __attendanceStore?: GlobalAttendanceStore };

export const store: GlobalAttendanceStore = (g.__attendanceStore ??= {
  students: [...defaultStudents],
  records: seedRecords(),
  devices: [...initialDevices],
  sessions: [...initialSessions],
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

export async function getAllSessions(): Promise<ClassSession[]> {
  const db = await getDb();
  if (db) {
    try {
      const items = (await db.collection("sessions").find({}).toArray()) as any;
      if (items.length > 0) return items;
    } catch (e) {
      console.warn("Mongo fetch sessions error:", e);
    }
  }
  return store.sessions;
}

export async function addSession(session: ClassSession): Promise<ClassSession> {
  store.sessions.unshift(session);
  const db = await getDb();
  if (db) {
    try {
      await db.collection("sessions").insertOne({ ...session } as any);
    } catch (e) {
      console.warn("Mongo add session error:", e);
    }
  }
  return session;
}

export async function toggleSessionStatus(sessionId: string): Promise<ClassSession | null> {
  const sess = store.sessions.find((s) => s.id === sessionId);
  if (sess) {
    sess.isActive = !sess.isActive;
  }
  const db = await getDb();
  if (db) {
    try {
      await db.collection("sessions").updateOne({ id: sessionId }, { $set: { isActive: sess?.isActive } });
    } catch (e) {
      console.warn("Mongo toggle session error:", e);
    }
  }
  return sess || null;
}
