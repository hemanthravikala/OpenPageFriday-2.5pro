import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Collect all API keys from environment
const apiKeys = [
  process.env.API_KEY1,
  process.env.API_KEY2,
  process.env.API_KEY3,
  process.env.API_KEY4,
  process.env.API_KEY5
].filter(Boolean); // Remove any undefined keys

if (apiKeys.length === 0) {
  console.error("No API keys found. Please set API_KEY1...API_KEY5 in your environment.");
  process.exit(1);
}

// Function to get random API key
function getRandomApiKey(exclude = []) {
  const availableKeys = apiKeys.filter(key => !exclude.includes(key));
  if (availableKeys.length === 0) return null;
  return availableKeys[Math.floor(Math.random() * availableKeys.length)];
}

// Endpoint for your chatbot
app.post("/chat", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  let usedKeys = [];
  let responseData = null;

  while (usedKeys.length < apiKeys.length && !responseData) {
    const apiKey = getRandomApiKey(usedKeys);
    if (!apiKey) break;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "openai/gpt-3.5-turbo", // Change to your preferred model
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        responseData = data;
        break;
      } else {
        console.error(`API error with key: ${apiKey}. Status: ${response.status}`);
        usedKeys.push(apiKey);
      }
    } catch (err) {
      console.error(`Request failed with key: ${apiKey}. Error: ${err.message}`);
      usedKeys.push(apiKey);
    }
  }

  if (responseData) {
    res.json(responseData);
  } else {
    res.status(500).json({ error: "All API keys failed. Please try again later." });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
