// server.js (ES module)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

// Configurable values via env
const OPENROUTER_URL = process.env.OPENROUTER_URL ?? "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = process.env.DEFAULT_MODEL ?? "deepseek/deepseek-r1-0528:free";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 25_000); // 25s default
const KEY_COOLDOWN_MS = Number(process.env.KEY_COOLDOWN_MS ?? 60_000); // 60s cooldown for failed keys

// Middleware
app.use(cors()); // allow all origins (safe because API keys are only on server)
app.options("*", cors());
app.use(express.json());
app.use(express.static("public")); // serve frontend files from /public

// ---------- Helper: load API keys from environment ----------
function loadKeysFromEnv() {
  const keys = new Set();

  if (process.env.OPENROUTER_KEYS) {
    process.env.OPENROUTER_KEYS.split(",").forEach(k => {
      const t = (k || "").trim();
      if (t) keys.add(t);
    });
  }

  // Also support OPENROUTER_KEY_1 ... OPENROUTER_KEY_10
  for (let i = 1; i <= 10; i++) {
    const name = `OPENROUTER_KEY_${i}`;
    if (process.env[name]) {
      const t = process.env[name].trim();
      if (t) keys.add(t);
    }
  }

  return Array.from(keys);
}

let INITIAL_KEYS = loadKeysFromEnv();
if (INITIAL_KEYS.length === 0) {
  console.error("No OpenRouter API keys found. Set OPENROUTER_KEYS (comma-separated) or OPENROUTER_KEY_1... in environment.");
  process.exit(1);
}

// In-memory tracking of recent key failures to avoid repeated immediate retries (app-wide)
const keyFailTimestamps = new Map(); // key -> lastFailMs

// Random pick helper
function pickRandomIndex(arrLen) {
  return Math.floor(Math.random() * arrLen);
}

// ---------- Core: call OpenRouter with fallback across keys ----------
async function callOpenRouterWithFallback(message, model = DEFAULT_MODEL) {
  // refresh keys in case env changed (optional)
  const allKeys = loadKeysFromEnv().filter(k => k && typeof k === "string");
  if (allKeys.length === 0) throw new Error("No API keys available");

  // start with keys that are not in recent-fail cooldown
  let available = allKeys.filter(k => {
    const t = keyFailTimestamps.get(k);
    return !t || (Date.now() - t) > KEY_COOLDOWN_MS;
  });

  // if none available (all in cooldown), try all keys anyway
  if (available.length === 0) available = [...allKeys];

  // track which keys we've tried in this request to avoid reuse
  while (available.length > 0) {
    const idx = pickRandomIndex(available.length);
    const key = available.splice(idx, 1)[0];

    console.log(`Trying key ${key.slice(0, 8)}...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const resp = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: message }]
        })
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        // mark key failed and continue
        const bodyText = await resp.text().catch(() => "<no body>");
        console.warn(`Key ${key.slice(0,8)} failed status ${resp.status}: ${bodyText}`);
        keyFailTimestamps.set(key, Date.now());
        continue;
      }

      const data = await resp.json().catch(() => null);
      if (!data) {
        console.warn(`Key ${key.slice(0,8)} returned empty JSON`);
        keyFailTimestamps.set(key, Date.now());
        continue;
      }

      // Try several common paths for the reply
      const content =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.message?.content?.text ??
        data?.choices?.[0]?.message?.content?.[0]?.text ??
        data?.output?.[0]?.content?.[0]?.text ??
        data?.result?.content ??
        data?.text ??
        null;

      if (content) {
        return { reply: content, keyUsed: key, raw: data };
      } else {
        // If structure differs, try to stringify short form to help debugging
        console.warn(`Key ${key.slice(0,8)} OK but no content. Response keys: ${Object.keys(data).join(", ")}`);
        // treat as failure for now
        keyFailTimestamps.set(key, Date.now());
        continue;
      }
    } catch (err) {
      clearTimeout(timeout);
      const errMsg = err?.name === "AbortError" ? "timeout" : (err.message || String(err));
      console.warn(`Key ${key.slice(0,8)} error: ${errMsg}`);
      keyFailTimestamps.set(key, Date.now());
      continue;
    }
  }

  // All keys exhausted
  throw new Error("All API keys failed");
}

// ---------- Routes ----------
app.post("/api/chat", async (req, res) => {
  try {
    const { message, model } = req.body ?? {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message (non-empty string) required in JSON body" });
    }

    const usedModel = typeof model === "string" && model.trim() ? model.trim() : DEFAULT_MODEL;

    const result = await callOpenRouterWithFallback(message, usedModel);
    // Return reply (keep minimal) but include lightweight meta if needed for debugging
    return res.json({
      reply: result.reply,
      meta: { model: usedModel, keyUsedPrefix: result.keyUsed?.slice(0,8) }
    });
  } catch (err) {
    console.error("Error in /api/chat:", err);
    return res.status(502).json({ error: "AI backend failed", detail: err.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
