import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  let body: {
    question?: string;
    bike?: Record<string, unknown>;
    profile?: Record<string, unknown> | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { question, bike, profile } = body;

  if (!question?.trim() || !bike) {
    return NextResponse.json({ error: "Missing question or bike" }, { status: 400 });
  }

  const bikeLines = [
    `Brand: ${bike.brand} ${bike.model} (${bike.year})`,
    `Category: ${bike.category}`,
    bike.travel ? `Travel: ${bike.travel}` : null,
    bike.wheel ? `Wheel: ${bike.wheel}` : null,
    bike.suspension ? `Suspension: ${bike.suspension}` : null,
    bike.frame ? `Frame: ${bike.frame}` : null,
    bike.fork ? `Fork: ${bike.fork}` : null,
    bike.shock ? `Shock: ${bike.shock}` : null,
    bike.drivetrain ? `Drivetrain: ${bike.drivetrain}` : null,
    bike.brakes ? `Brakes: ${bike.brakes}` : null,
    bike.weight ? `Weight: ${bike.weight}` : null,
    bike.isEbike ? `Type: eBike` : null,
    bike.motor ? `Motor: ${bike.motor}` : null,
    bike.battery ? `Battery: ${bike.battery}` : null,
    bike.range ? `Range: ${bike.range}` : null,
  ].filter(Boolean).join("\n");

  const profileLines = profile
    ? [
        `Height: ${profile.heightCm}cm`,
        `Weight: ${profile.weightKg}kg`,
        `Riding style: ${profile.style}`,
        profile.preferEbike ? "Prefers eBikes: yes" : null,
      ].filter(Boolean).join(", ")
    : null;

  const systemPrompt = [
    "You are a knowledgeable mountain bike advisor for Australian riders.",
    "Answer questions concisely and specifically about the bike provided.",
    "Be direct. Use 2-4 sentences max. No fluff, no bullet points unless listing options.",
    "If asked about price, mention AUD. If asked about sizing, reference the rider's height if provided.",
    "If you don't know something specific, say so honestly and give your best general advice.",
  ].join(" ");

  const userMessage = [
    `Bike: ${bikeLines}`,
    profileLines ? `Rider: ${profileLines}` : null,
    `Question: ${question.trim()}`,
  ].filter(Boolean).join("\n\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic API error:", err);
      return NextResponse.json({ error: "AI unavailable" }, { status: 502 });
    }

    const data = await res.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const answer = data.content.find((c) => c.type === "text")?.text ?? "";
    return NextResponse.json({ answer });
  } catch (e) {
    console.error("Ask API error:", e);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
