import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ source: "none", maskUrl: null })
}
