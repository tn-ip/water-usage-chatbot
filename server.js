import express from "express";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MAX_TURNS = 12;
const MAX_CHARS = 2000;

const SYSTEM_PROMPT = `Your jobs:

1) Answer questions about water usage (home, school, Hong Kong), saving water, and environmentally friendly habits.

2) Collect short feedback about students’ eco-friendly water habits when they want to share.

How to reply:

- Keep answers short and clear (a few sentences). Use simple English unless the student writes Chinese; then reply in Chinese.
- Be encouraging, not scolding. If you don’t know something on-topic, say so and suggest asking their teacher.
- For feedback: ask 1–2 short questions (e.g. how they save water at home/school), then thank them and summarise what they said.
- Do not give medical, legal, or unsafe advice. Do not collect personal details (full name, phone, address, school ID).

Strict topic rule:

- Only answer questions about water usage, water saving, and environmentally friendly habits related to water/environment.
- Do NOT answer irrelevant questions (e.g. homework for other subjects, games, jokes, personal chat, politics, celebrities).
- If the question is off-topic, reply briefly: “I only answer questions about water usage and eco-friendly habits. Please ask something related to that.” Then stop. Do not answer the off-topic content.
`;

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "48kb" }));

const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many messages. Please wait a few minutes and try again.",
  },
});

function textOf(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_CHARS) : "";
}

function toTurn(entry) {
  if (!entry || typeof entry !== "object") return null;
  const role = entry.role === "assistant" || entry.role === "user" ? entry.role : null;
  const content = textOf(entry.content);
  if (!role || !content) return null;
  return { role, content };
}

function conversationFrom(body) {
  const source = body && typeof body === "object" ? body : {};
  const turns = [];

  if (Array.isArray(source.messages)) {
    for (const entry of source.messages) {
      const turn = toTurn(entry);
      if (turn) turns.push(turn);
    }
  } else {
    if (Array.isArray(source.history)) {
      for (const entry of source.history) {
        const turn = toTurn(entry);
        if (turn) turns.push(turn);
      }
    }
    const message = textOf(source.message);
    if (message) turns.push({ role: "user", content: message });
  }

  return turns.slice(-MAX_TURNS);
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(process.env.DEEPSEEK_API_KEY),
  });
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error:
        "The water chatbot is not ready yet. Please ask your teacher to add the DeepSeek API key.",
    });
  }

  const turns = conversationFrom(req.body);
  if (!turns.length || turns[turns.length - 1].role !== "user") {
    return res.status(400).json({
      error: "Please type a message about water use or a water habit.",
    });
  }

  try {
    const upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.45,
        max_tokens: 400,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...turns],
      }),
      signal: AbortSignal.timeout(30000),
    });

    let data = null;
    try {
      data = await upstream.json();
    } catch {
      data = null;
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (!upstream.ok || typeof reply !== "string" || !reply.trim()) {
      console.error("DeepSeek request failed", upstream.status);
      return res.status(502).json({
        error: "The chatbot could not answer just now. Please try again in a moment.",
      });
    }

    return res.json({ reply: reply.trim() });
  } catch (error) {
    console.error("Chat request error", error?.name || "Error");
    return res.status(502).json({
      error: "The chatbot could not answer just now. Please try again in a moment.",
    });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "That message could not be read. Please try again.",
    });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      error: "That message is too long. Please send a shorter one.",
    });
  }
  console.error("Server error");
  return res.status(500).json({
    error: "Something went wrong. Please try again.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  const configured = Boolean(process.env.DEEPSEEK_API_KEY);
  console.log(
    `Water usage chatbot listening on 0.0.0.0:${PORT} (DeepSeek ${
      configured ? "configured" : "not configured"
    })`
  );
});
