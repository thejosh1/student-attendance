import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "firmware", "futo_attendance_esp32.ino");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Firmware sketch file not found" }, { status: 404 });
    }
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="futo_attendance_esp32.ino"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to read firmware file" }, { status: 500 });
  }
}
