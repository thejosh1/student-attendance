import { NextResponse } from "next/server";
import { resetAllData } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await resetAllData();
    return NextResponse.json({
      success: true,
      message: "Database wiped clean! All dummy data removed. Next enrolled student will be assigned Slot #1.",
    });
  } catch (error: any) {
    console.error("Reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset database", details: error?.message },
      { status: 500 }
    );
  }
}
