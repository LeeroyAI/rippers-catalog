/**
 * api/chat.js — Rippers AI Chat
 *
 * Accepts a conversation and returns a Claude-powered reply.
 * Used by the Help and Results AI chat features in the iOS app.
 *
 * Environment variables required (same as api/search.js):
 *   ANTHROPIC_API_KEY — https://console.anthropic.com
 */

import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a knowledgeable, friendly assistant for Rippers — an Australian mountain bike finder app.

Your job is to help riders find, choose, and buy the right MTB for their body, budget, and riding style.

Key facts about Rippers:
- Curated catalog of ~48 AU-market MTBs with real retailer prices in AUD
- Categories: Trail, Enduro, XC/Cross-Country, Downhill, eBike, Hardtail
- Features: profile-based matching, live web search (Brave+Claude), side-by-side comparison, watchlist with price alerts, full budget planner (bike + gear + hidden costs), trip planner with trail/shop finder, and frame sizing advisor
- AU retailers include 99 Bikes, Pushys, BikeExchange, Chain Reaction AU, BikesOnline, and others
- All prices AUD; prices can fluctuate so always recommend checking retailers directly

Style guide:
- Concise answers — 2–4 sentences unless more detail is genuinely needed
- Practical and direct — give a recommendation, not just options
- MTB-knowledgeable — use correct terminology (travel, geometry, suspension, hardtail vs full-sus, etc.)
- Never make up specific prices or stock — refer users to search or check retailers`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY" });
  }

  const { messages, context } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  const validMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content ?? "") }));

  if (validMessages.length === 0) {
    return res.status(400).json({ error: "No valid messages" });
  }

  const systemWithContext = context
    ? `${SYSTEM_PROMPT}\n\nContext about the user's current session:\n${context}`
    : SYSTEM_PROMPT;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      system: systemWithContext,
      messages: validMessages,
    });

    const reply =
      response.content[0]?.text?.trim() ??
      "Sorry, I couldn't generate a response right now.";

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: err.message ?? "AI error" });
  }
}
