import { NextResponse } from "next/server"

export async function POST(request) {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN이 없습니다." },
      { status: 501 },
    )
  }

  const body = await request.json().catch(() => null)
  const image = body?.image
  const x = Number(body?.x)
  const y = Number(body?.y)
  if (!image || !Number.isFinite(x) || !Number.isFinite(y)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  const started = await fetch(
    "https://api.replicate.com/v1/models/meta/sam-2/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        input: {
          image,
          points: [`${Math.round(x)},${Math.round(y)}`],
          labels: "1",
        },
      }),
    },
  )
  const prediction = await started.json().catch(() => ({}))
  if (!started.ok) {
    return NextResponse.json(
      { error: prediction.detail || prediction.error || "Replicate 요청 실패" },
      { status: started.status },
    )
  }

  const output = prediction.output
  const maskUrl = Array.isArray(output)
    ? output[0]
    : output?.combined_mask || output?.mask || output
  if (!maskUrl || typeof maskUrl !== "string") {
    return NextResponse.json(
      { error: "마스크 결과를 받지 못했습니다." },
      { status: 502 },
    )
  }

  return NextResponse.json({ maskUrl })
}
