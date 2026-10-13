import { NextRequest, NextResponse } from "next/server";
import { findLecturerByEmail, getAllLecturers, saveLecturer, LecturerAccount } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "login";

    if (action === "register") {
      const { name, email, password, department, staffId } = body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Lecturer name is required." }, { status: 400 });
      }
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
      }
      if (!password || typeof password !== "string" || password.length < 4) {
        return NextResponse.json({ error: "Password must be at least 4 characters." }, { status: 400 });
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = await findLecturerByEmail(cleanEmail);
      if (existing) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in instead." },
          { status: 409 }
        );
      }

      const newLecturer: LecturerAccount = {
        id: `lec-${Date.now()}`,
        name: name.trim(),
        email: cleanEmail,
        password: password.trim(),
        staffId: staffId?.trim() || `FUTO/STF/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
        department: department?.trim() || "School of Engineering & Engineering Technology (SEET)",
        title: "Course Lecturer",
        role: "lecturer",
        createdAt: new Date().toISOString(),
      };

      await saveLecturer(newLecturer);

      // Return safe user object (excluding plain password)
      const { password: _, ...safeUser } = newLecturer;
      return NextResponse.json({
        success: true,
        message: "Account created successfully.",
        user: safeUser,
      });
    }

    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanPass = String(password).trim();

      // Check registered accounts first
      const lecturer = await findLecturerByEmail(cleanEmail);
      if (lecturer && lecturer.password === cleanPass) {
        const { password: _, ...safeUser } = lecturer;
        return NextResponse.json({ success: true, user: safeUser });
      }

      // Check default fallback demo account
      if (
        (cleanEmail === "lecturer@futo.edu.ng" && (cleanPass === "password123" || cleanPass === "futo2026" || cleanPass === "admin")) ||
        (cleanEmail.endsWith("@futo.edu.ng") && cleanPass === "password123")
      ) {
        const fallbackUser = {
          id: "lec-futo-01",
          name: "Engr. Prof. K. C. Okafor",
          email: cleanEmail,
          staffId: "FUTO/STF/2014/098",
          department: "Telecommunication Engineering (SEET)",
          title: "Professor & Course Coordinator",
          role: "lecturer" as const,
        };
        return NextResponse.json({ success: true, user: fallbackUser });
      }

      return NextResponse.json(
        { error: "Invalid lecturer credentials. Check your email and password." },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err: any) {
    console.error("Auth API error:", err);
    return NextResponse.json({ error: err.message || "Authentication error" }, { status: 500 });
  }
}

export async function GET() {
  const lecturers = await getAllLecturers();
  const safeList = lecturers.map(({ password: _, ...safe }) => safe);
  return NextResponse.json({ lecturers: safeList });
}
