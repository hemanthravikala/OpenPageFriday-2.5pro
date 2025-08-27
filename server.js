// server.js
import express from "express";
import OpenAI from "openai";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Collect all API keys from environment
const apiKeys = [
  process.env.API_KEY_1,
  process.env.API_KEY_2,
  process.env.API_KEY_3,
  process.env.API_KEY_4,
  process.env.API_KEY_5,
].filter(Boolean);

if (apiKeys.length === 0) {
  console.error("No API keys found in environment variables!");
  process.exit(1);
}

// Function to create OpenAI client with a key
function createClient(apiKey) {
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
}

app.post("/ask", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  let availableKeys = [...apiKeys];
  let finalResponse = null;
  let success = false;

  while (availableKeys.length > 0 && !success) {
    const randomIndex = Math.floor(Math.random() * availableKeys.length);
    const currentKey = availableKeys[randomIndex];
    availableKeys.splice(randomIndex, 1);

    console.log(`Trying with API key: ${currentKey.substring(0, 6)}...`);

    try {
      const openai = createClient(currentKey);

      const completion = await openai.chat.completions.create({
        model: "meta-llama/llama-3.3-8b-instruct:free",
        messages: [{ role: "user", content: prompt }],
      });

      finalResponse = completion.choices[0].message;
      success = true;
    } catch (error) {
      console.error(`Error with key ${currentKey.substring(0, 6)}:`, error.message);
    }
  }

  if (success) {
    return res.json({ success: true, data: finalResponse });
  } else {
    return res.status(500).json({ error: "Error occurred, please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
