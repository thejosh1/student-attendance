import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "futo_esp32_hardware_package.zip");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Zip package not found" }, { status: 404 });
    }
    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="futo_esp32_hardware_package.zip"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to download zip package" }, { status: 500 });
  }
}
