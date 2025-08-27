import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Collect all API keys from environment
const apiKeys = [
  process.env.API_KEY_1,
  process.env.API_KEY_2,
  process.env.API_KEY_3,
  process.env.API_KEY_4,
  process.env.API_KEY_5,
].filter(Boolean); // Remove undefined keys

if (apiKeys.length === 0) {
  console.error("❌ No API keys found in environment variables!");
  process.exit(1);
}

// API endpoint
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(400).json({ error: "Message is required" });
  }

  const triedKeys = new Set();

  async function tryRequest() {
    if (triedKeys.size === apiKeys.length) {
      throw new Error("All API keys failed.");
    }

    // Pick a random key not used yet
    const availableKeys = apiKeys.filter((_, idx) => !triedKeys.has(idx));
    const randomIndex = Math.floor(Math.random() * availableKeys.length);
    const keyIndex = apiKeys.indexOf(availableKeys[randomIndex]);
    const apiKey = availableKeys[randomIndex];
    triedKeys.add(keyIndex);

    try {
      const response = await fetch("https://api.openrouter.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-4", // change to the model you want
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error with key index ${keyIndex}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn(`⚠️ Failed with key index ${keyIndex}: ${error.message}`);
      return tryRequest(); // Retry with another key
    }
  }

  try {
    const result = await tryRequest();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
