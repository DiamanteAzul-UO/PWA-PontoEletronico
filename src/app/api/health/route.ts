import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({
      status: "online",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      database: "ok",
    });
  } catch {
    return NextResponse.json(
      { status: "degraded", timestamp: new Date().toISOString(), database: "error" },
      { status: 200 }
    );
  }
}
